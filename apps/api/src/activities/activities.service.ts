import { Injectable, HttpStatus } from '@nestjs/common';
import { createHash } from 'crypto';
import { unlink } from 'fs/promises';
import { ActivityStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ImportNativeActivityDto } from './dto/import-native-activity.dto';
import { ApiException } from '../common/api.exception';
import { ErrorCodes } from '../common/error-codes';
import { sanitizeTrackPoints } from '../common/track.util';
import { GpxParserService, GpxParseError } from './gpx-parser.service';
import {
  SamsungHealthParserService,
  SamsungHealthParseError,
} from './samsung-health-parser.service';

type DbClient = PrismaService | Prisma.TransactionClient;

const GPX_IMPORT_PROVIDER = 'gpx_import';
const SAMSUNG_ZIP_PROVIDER = 'samsung_health_zip';
const MAX_GPX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_SAMSUNG_ZIP_BYTES = 350 * 1024 * 1024;

@Injectable()
export class ActivitiesService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private gpxParserService: GpxParserService,
    private samsungHealthParserService: SamsungHealthParserService,
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

  async importSamsungZip(
    userId: string,
    file: { path: string; originalname: string; size: number },
    days = 365,
  ) {
    if (!file?.path) {
      throw new ApiException(
        ErrorCodes.INVALID_FILE,
        'No file uploaded',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (file.size > MAX_SAMSUNG_ZIP_BYTES) {
      await unlink(file.path).catch(() => {});
      throw new ApiException(
        ErrorCodes.INVALID_FILE,
        'ZIP archive is too large (max 350 MB)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const lowerName = file.originalname.toLowerCase();
    if (!lowerName.endsWith('.zip')) {
      await unlink(file.path).catch(() => {});
      throw new ApiException(
        ErrorCodes.INVALID_FILE,
        'Only ZIP archives from Samsung Health export are supported',
        HttpStatus.BAD_REQUEST,
      );
    }

    const summary = {
      imported: 0,
      duplicates: 0,
      withoutRoute: 0,
      total: 0,
      skippedByDate: 0,
      withGps: 0,
      exerciseFilesScanned: 0,
      hint: undefined as string | undefined,
      activityIds: [] as string[],
    };

    let importedCandidates = 0;

    try {
      const parsed = await this.samsungHealthParserService.consumeWorkouts(
        file.path,
        { days },
        async (workout) => {
          importedCandidates += 1;

          const duplicate = await this.prisma.processedActivity.findUnique({
            where: {
              provider_externalActivityId: {
                provider: SAMSUNG_ZIP_PROVIDER,
                externalActivityId: workout.id,
              },
            },
          });

          if (duplicate) {
            summary.duplicates += 1;
            return;
          }

          const avgPace =
            workout.distanceMeters > 0
              ? Math.round(workout.durationSeconds / (workout.distanceMeters / 1000))
              : undefined;

          const activity = await this.prisma.$transaction(async (tx) => {
            await tx.processedActivity.create({
              data: {
                provider: SAMSUNG_ZIP_PROVIDER,
                externalActivityId: workout.id,
              },
            });

            return this.createFromExternal(
              userId,
              {
                source: 'samsung_health_zip',
                distanceMeters: workout.distanceMeters,
                durationSeconds: workout.durationSeconds,
                avgPace,
                startedAt: workout.startedAt,
                finishedAt: workout.finishedAt,
                track: workout.points.map((point) => ({
                  lat: point.lat,
                  lng: point.lng,
                  timestamp: point.timestamp,
                })),
              },
              tx,
            );
          });

          await this.enqueueActivity(activity.id);
          summary.imported += 1;
          summary.activityIds.push(activity.id);
        },
      );

      summary.withoutRoute = parsed.withoutRoute;
      summary.total = parsed.totalSessions;
      summary.skippedByDate = parsed.skippedByDate;
      summary.withGps = parsed.withGps;
      summary.exerciseFilesScanned = parsed.exerciseFilesScanned;
      summary.hint = parsed.hint;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      const message =
        error instanceof SamsungHealthParseError
          ? error.message
          : importedCandidates > 0 || summary.imported > 0
            ? `Import interrupted after ${summary.imported} workout(s): ${
                error instanceof Error ? error.message : 'unknown error'
              }`
            : error instanceof Error
              ? error.message
              : 'Failed to parse Samsung Health export';
      throw new ApiException(ErrorCodes.INVALID_FILE, message, HttpStatus.BAD_REQUEST);
    } finally {
      await unlink(file.path).catch(() => {});
    }

    if (summary.imported === 0 && summary.duplicates === 0 && importedCandidates === 0) {
      const detail =
        summary.hint ??
        `No runnable workouts with GPS found in the last ${days} days (sessions: ${summary.total}, with GPS: ${summary.withGps}, without route: ${summary.withoutRoute}, too old: ${summary.skippedByDate})`;
      throw new ApiException(ErrorCodes.INVALID_FILE, detail, HttpStatus.BAD_REQUEST);
    }

    return summary;
  }

  async importNativeWorkout(userId: string, dto: ImportNativeActivityDto) {
    if (!dto.track || dto.track.length < 2) {
      throw new ApiException(
        ErrorCodes.INVALID_FILE,
        'Workout has no GPS track — cannot capture territory without route points',
        HttpStatus.BAD_REQUEST,
      );
    }

    const duplicate = await this.prisma.processedActivity.findUnique({
      where: {
        provider_externalActivityId: {
          provider: dto.source,
          externalActivityId: dto.platformId,
        },
      },
    });

    if (duplicate) {
      throw new ApiException(
        ErrorCodes.DUPLICATE_ACTIVITY,
        'This workout was already imported',
        HttpStatus.CONFLICT,
      );
    }

    const track = sanitizeTrackPoints(
      dto.track.map((point) => ({
        lat: point.lat,
        lng: point.lng,
        timestamp: point.timestamp,
      })),
    );

    if (track.length < 2) {
      throw new ApiException(
        ErrorCodes.INVALID_FILE,
        'Workout GPS track is too sparse after cleanup — cannot capture territory',
        HttpStatus.BAD_REQUEST,
      );
    }

    const activity = await this.prisma.$transaction(async (tx) => {
      await tx.processedActivity.create({
        data: {
          provider: dto.source,
          externalActivityId: dto.platformId,
        },
      });

      return this.createFromExternal(
        userId,
        {
          source: dto.source,
          distanceMeters: dto.distanceMeters,
          durationSeconds: dto.durationSeconds,
          avgPace: dto.avgPace,
          startedAt: new Date(dto.startedAt),
          finishedAt: new Date(dto.finishedAt),
          track,
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

  async reprocessFailedActivities(userId: string) {
    const failed = await this.prisma.activity.findMany({
      where: {
        userId,
        status: ActivityStatus.failed,
        failureReason: { in: ['SPEED_EXCEEDED', 'GPS_ANOMALY'] },
      },
      include: { track: true },
    });

    let requeued = 0;

    for (const activity of failed) {
      const route = activity.track?.route as
        | { lat: number; lng: number; timestamp?: string }[]
        | undefined;
      if (!route?.length) continue;

      const sanitized = sanitizeTrackPoints(route);
      if (sanitized.length < 2) continue;

      await this.prisma.$transaction([
        this.prisma.activityTrack.update({
          where: { activityId: activity.id },
          data: { route: sanitized as unknown as Prisma.InputJsonValue },
        }),
        this.prisma.activity.update({
          where: { id: activity.id },
          data: {
            status: ActivityStatus.processing,
            failureReason: null,
            processedAt: null,
          },
        }),
      ]);

      await this.enqueueActivity(activity.id);
      requeued += 1;
    }

    return { requeued };
  }
}
