import { Injectable, HttpStatus } from '@nestjs/common';
import { ActivityStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ApiException } from '../common/api.exception';
import { ErrorCodes } from '../common/error-codes';

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ActivitiesService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
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
