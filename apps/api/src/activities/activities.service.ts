import { Injectable, HttpStatus } from '@nestjs/common';
import { createHash } from 'crypto';
import { ActivityStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ApiException } from '../common/api.exception';
import { ErrorCodes } from '../common/error-codes';
import { GpxParserService, GpxParseError } from './gpx-parser.service';

type DbClient = PrismaService | Prisma.TransactionClient;

const GPX_IMPORT_PROVIDER = 'gpx_import';
const MAX_GPX_FILE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ActivitiesService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private gpxParserService: GpxParserService,
  ) {}

  async create(userId: string, dto: CreateActivityDto) {
    const activity = await this.createFromExternal(userId, {
      source: dto.source,
      distanceMeters: dto.distanceMeters,
      durationSeconds: dto.durationSeconds,
      avgPace: dto.avgPace,
      startedAt: new Date(dto.startedAt),
      finishedAt: new Date(dto.finishedAt),
      track: dto.track,
    });

    await this.enqueueActivity(activity.id);
    return activity;
  }

  async importGpxFile(
    userId: string,
    file: { buffer: Buffer; originalname: string; size: number },
  ) {
    if (!file || !file.buffer?.length) {
      throw new ApiException(
        ErrorCodes.INVALID_FILE,
        'No file uploaded',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (file.size > MAX_GPX_FILE_BYTES) {
      throw new ApiException(
        ErrorCodes.INVALID_FILE,
        'File is too large (max 5 MB)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const lowerName = file.originalname.toLowerCase();
    if (!lowerName.endsWith('.gpx')) {
      throw new ApiException(
        ErrorCodes.INVALID_FILE,
        'Only GPX files are supported for now',
        HttpStatus.BAD_REQUEST,
      );
    }

    const fileContent = file.buffer.toString('utf-8');
    const fileHash = createHash('sha256').update(fileContent).digest('hex');

    const duplicate = await this.prisma.processedActivity.findUnique({
      where: {
        provider_externalActivityId: {
          provider: GPX_IMPORT_PROVIDER,
          externalActivityId: fileHash,
        },
      },
    });

    if (duplicate) {
      throw new ApiException(
        ErrorCodes.DUPLICATE_ACTIVITY,
        'This track was already uploaded',
        HttpStatus.CONFLICT,
      );
    }

    let parsed;
    try {
      parsed = this.gpxParserService.parseGpx(fileContent);
    } catch (error) {
      const message =
        error instanceof GpxParseError
          ? error.message
          : 'GPX file is damaged or does not contain GPS data';
      throw new ApiException(ErrorCodes.INVALID_FILE, message, HttpStatus.BAD_REQUEST);
    }

    const avgPace =
      parsed.distanceMeters > 0
        ? Math.round(parsed.durationSeconds / (parsed.distanceMeters / 1000))
        : undefined;

    const activity = await this.prisma.$transaction(async (tx) => {
      await tx.processedActivity.create({
        data: {
          provider: GPX_IMPORT_PROVIDER,
          externalActivityId: fileHash,
        },
      });

      return this.createFromExternal(
        userId,
        {
          source: 'gpx_import',
          distanceMeters: parsed.distanceMeters,
          durationSeconds: parsed.durationSeconds,
          avgPace,
          startedAt: parsed.startedAt,
          finishedAt: parsed.finishedAt,
          track: parsed.points.map((point) => ({
            lat: point.lat,
            lng: point.lng,
            timestamp: point.timestamp,
          })),
        },
        tx,
      );
    });

    await this.enqueueActivity(activity.id);
    return activity;
  }

  async listForUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          source: true,
          distanceMeters: true,
          durationSeconds: true,
          avgPace: true,
          startedAt: true,
          finishedAt: true,
          status: true,
          failureReason: true,
          processedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.activity.count({ where: { userId } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createFromExternal(
    userId: string,
    params: {
      source: string;
      distanceMeters: number;
      durationSeconds: number;
      avgPace?: number;
      startedAt: Date;
      finishedAt: Date;
      track: { lat: number; lng: number; timestamp?: string }[];
    },
    db: DbClient = this.prisma,
  ) {
    return db.activity.create({
      data: {
        userId,
        source: params.source,
        distanceMeters: params.distanceMeters,
        durationSeconds: params.durationSeconds,
        avgPace: params.avgPace,
        startedAt: params.startedAt,
        finishedAt: params.finishedAt,
        status: ActivityStatus.processing,
        track: {
          create: {
            route: params.track as unknown as Prisma.InputJsonValue,
          },
        },
      },
      include: { track: true },
    });
  }

  async enqueueActivity(activityId: string) {
    await this.queueService.addActivityProcessingJob(activityId);
  }

  async getStatus(userId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, userId },
      select: {
        status: true,
        failureReason: true,
      },
    });

    if (!activity) {
      throw new ApiException(
        ErrorCodes.NOT_FOUND,
        'Activity not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      status: activity.status,
      ...(activity.failureReason ? { reason: activity.failureReason } : {}),
    };
  }
}
