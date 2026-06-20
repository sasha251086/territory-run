import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateActivityDto } from './dto/create-activity.dto';

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
        track: {
          create: {
            route: dto.track as any,
          },
        },
      },
      include: { track: true },
    });

    await this.queueService.addActivityProcessingJob(activity.id);
    return activity;
  }
}