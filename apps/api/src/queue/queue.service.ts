import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { InfluenceService } from '../territories/influence.service';
import { OwnershipService } from '../territories/ownership.service';
import { FeedService } from '../feed/feed.service';

@Injectable()
export class QueueService implements OnModuleInit {
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private prisma: PrismaService,
    private influenceService: InfluenceService,
    private ownershipService: OwnershipService,
    private feedService: FeedService,
  ) {}

  onModuleInit() {
    const connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('activity-processing', { connection });

    this.worker = new Worker(
      'activity-processing',
      async (job) => {
        const { activityId } = job.data;
        await this.processActivity(activityId);
      },
      { connection },
    );

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      if (job) {
        console.error(`Job ${job.id} failed:`, err);
      } else {
        console.error('Job failed:', err);
      }
    });
  }

  async addActivityProcessingJob(activityId: string) {
    await this.queue.add('process', { activityId });
  }

  private async processActivity(activityId: string) {
    console.log(`Processing activity ${activityId}`);

    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { track: true },
    });
    if (!activity) throw new Error('Activity not found');

    const track = activity.track?.route as { lat: number; lng: number }[];
    if (!track || track.length === 0) throw new Error('No track points');

    const affectedCells = await this.influenceService.processTrack(activity.userId, track);
    await this.ownershipService.recalculateOwners(affectedCells);

    await this.prisma.userStats.upsert({
      where: { userId: activity.userId },
      update: {
        totalDistance: { increment: activity.distanceMeters },
        totalRuns: { increment: 1 },
      },
      create: {
        userId: activity.userId,
        totalDistance: activity.distanceMeters,
        totalRuns: 1,
      },
    });

    const stats = await this.prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT "h3Index") as cells,
        SUM("influence") as influence
      FROM "CellOwnership"
      WHERE "userId" = ${activity.userId}
    ` as any[];

    await this.prisma.userStats.update({
      where: { userId: activity.userId },
      data: {
        cellsOwned: Number(stats[0]?.cells || 0),
        totalInfluence: Number(stats[0]?.influence || 0),
      },
    });

    await this.feedService.createEvent('activity_completed', activity.userId, {
      activityId: activity.id,
      distance: activity.distanceMeters,
      duration: activity.durationSeconds,
      cellsAffected: affectedCells.length,
    });

    await this.prisma.activity.update({
      where: { id: activityId },
      data: { processedAt: new Date() },
    });

    console.log(`Activity ${activityId} processed successfully`);
  }
}