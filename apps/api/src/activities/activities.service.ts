import { Injectable, HttpStatus } from '@nestjs/common';
import { ActivityStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ApiException } from '../common/api.exception';
import { ErrorCodes } from '../common/error-codes';

@Injectable()
export class ActivitiesService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async create(userId: string, dto: CreateActivityDto) {
    const activity = await this.prisma.activity.create({
      data: {
        userId,
        source: dto.source,
        distanceMeters: dto.distanceMeters,
        durationSeconds: dto.durationSeconds,
        avgPace: dto.avgPace,
        startedAt: new Date(dto.startedAt),
        finishedAt: new Date(dto.finishedAt),
        status: ActivityStatus.processing,
        track: {
          create: {
            route: dto.track as unknown as Prisma.InputJsonValue,
          },
        },
      },
      include: { track: true },
    });

    await this.queueService.addActivityProcessingJob(activity.id);
    return activity;
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
