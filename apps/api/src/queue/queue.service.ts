import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ActivityStatus } from '@prisma/client';
import * as h3 from 'h3-js';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { InfluenceService } from '../territories/influence.service';
import { OwnershipService } from '../territories/ownership.service';
import { FeedService } from '../feed/feed.service';
import { AnticheatService, TrackPoint } from '../activities/anticheat.service';
import { sanitizeTrackPoints } from '../common/track.util';
import { haversineDistance } from '../common/geo.util';
import { captureException } from '../common/sentry.util';
import { nextStreakState } from '../common/streak.util';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queue!: Queue;
  private worker!: Worker;
  private redisConnection!: Redis;

  constructor(
    private prisma: PrismaService,
    private influenceService: InfluenceService,
    private ownershipService: OwnershipService,
    private feedService: FeedService,
    private anticheatService: AnticheatService,
  ) {}

  onModuleInit() {
    this.redisConnection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('activity-processing', { connection: this.redisConnection });

    this.worker = new Worker(
      'activity-processing',
      async (job) => {
        const { activityId } = job.data;
        await this.processActivity(activityId);
      },
      { connection: this.redisConnection },
    );

    this.worker.on('completed', (job) => {
      this.logger.log({
        msg: 'Activity processing job completed',
        jobId: job.id,
        activityId: job.data?.activityId,
      });
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error({
        msg: 'Activity processing job failed',
        jobId: job?.id,
        activityId: job?.data?.activityId,
        err,
      });
      captureException(err, {
        jobId: job?.id,
        activityId: job?.data?.activityId,
        queue: 'activity-processing',
      });
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.redisConnection?.quit();
  }

  async addActivityProcessingJob(activityId: string) {
    await this.queue.add('process', { activityId });
  }

  async getJobCounts() {
    return this.queue.getJobCounts();
  }

  async processActivity(activityId: string) {
    this.logger.log({ msg: 'Processing activity', activityId });

    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { track: true },
    });
    if (!activity) throw new Error('Activity not found');

    const rawTrack = activity.track?.route as TrackPoint[] | undefined;
    if (!rawTrack || rawTrack.length === 0) throw new Error('No track points');

    const track = sanitizeTrackPoints(rawTrack);
    if (track.length < 2) throw new Error('No track points after sanitization');

    const validation = this.anticheatService.validateTrack(track);
    if (validation.valid === false) {
      const { reason } = validation;
      await this.failActivity(activityId, activity, reason);
      return;
    }

    const trackDistance = this.calculateTrackDistance(track);
    const distanceCheck = this.anticheatService.validateClaimedDistance(
      trackDistance,
      activity.distanceMeters,
    );
    if (distanceCheck.valid === false) {
      await this.failActivity(activityId, activity, distanceCheck.reason);
      return;
    }

    const previewCells = new Set<string>();
    for (const point of track) {
      previewCells.add(h3.latLngToCell(point.lat, point.lng, 9));
    }
    const previewIndices = [...previewCells];
    const previousOwners = await this.ownershipService.snapshotOwners(previewIndices);

    const affectedCells = await this.influenceService.processTrack(activity.userId, track);
    const ownerResults = await this.ownershipService.recalculateOwners(
      affectedCells.h3Indices,
      previousOwners,
    );

    const seasonNewCaptures = ownerResults.filter(
      (result) =>
        result.ownerId === activity.userId &&
        previousOwners.get(result.h3Index) !== activity.userId,
    ).length;

    const existingStats = await this.prisma.userStats.findUnique({
      where: { userId: activity.userId },
    });
    const streakState = nextStreakState(
      existingStats?.currentStreak ?? 0,
      existingStats?.lastRunDate ?? null,
      activity.finishedAt,
    );

    await this.prisma.userStats.upsert({
      where: { userId: activity.userId },
      update: {
        totalDistance: { increment: activity.distanceMeters },
        totalRuns: { increment: 1 },
        currentStreak: streakState.currentStreak,
        lastRunDate: streakState.lastRunDate,
      },
      create: {
        userId: activity.userId,
        totalDistance: activity.distanceMeters,
        totalRuns: 1,
        currentStreak: streakState.currentStreak,
        lastRunDate: streakState.lastRunDate,
      },
    });

    const stats = (await this.prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT "h3Index") as cells,
        SUM("influence") as influence
      FROM "CellOwnership"
      WHERE "userId" = ${activity.userId}
    `) as { cells: bigint; influence: number }[];

    await this.prisma.userStats.update({
      where: { userId: activity.userId },
      data: {
        cellsOwned: Number(stats[0]?.cells || 0),
        totalInfluence: Number(stats[0]?.influence || 0),
        seasonCellsOwned: { increment: seasonNewCaptures },
        seasonInfluence: { increment: affectedCells.influenceAdded },
      },
    });

    await this.feedService.createEvent('activity_completed', activity.userId, {
      activityId: activity.id,
      distance: activity.distanceMeters,
      duration: activity.durationSeconds,
      cellsAffected: affectedCells.h3Indices.length,
    });

    await this.prisma.activity.update({
      where: { id: activityId },
      data: {
        status: ActivityStatus.completed,
        processedAt: new Date(),
      },
    });

    this.logger.log({
      msg: 'Activity processed successfully',
      activityId,
      userId: activity.userId,
      cellsAffected: affectedCells.h3Indices.length,
    });
  }

  private calculateTrackDistance(track: TrackPoint[]): number {
    let total = 0;
    for (let i = 1; i < track.length; i++) {
      total += haversineDistance(
        track[i - 1].lat,
        track[i - 1].lng,
        track[i].lat,
        track[i].lng,
      );
    }
    return Math.round(total);
  }

  private async failActivity(
    activityId: string,
    activity: { id: string; userId: string; distanceMeters: number; durationSeconds: number },
    reason: string,
  ) {
    await this.prisma.activity.update({
      where: { id: activityId },
      data: {
        status: ActivityStatus.failed,
        failureReason: reason,
        processedAt: new Date(),
      },
    });

    await this.feedService.createEvent('activity_completed', activity.userId, {
      activityId: activity.id,
      distance: activity.distanceMeters,
      duration: activity.durationSeconds,
      cellsAffected: 0,
      flagged: true,
      reason,
    });

    this.logger.warn({
      msg: 'Activity rejected by anticheat',
      activityId,
      userId: activity.userId,
      reason,
    });
  }
}
