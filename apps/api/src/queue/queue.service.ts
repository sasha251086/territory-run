import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ActivityStatus } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { InfluenceService } from '../territories/influence.service';
import { OwnershipService } from '../territories/ownership.service';
import { FeedService } from '../feed/feed.service';
import { AnticheatService, TrackPoint } from '../activities/anticheat.service';
import { sanitizeTrackPoints } from '../common/track.util';
import { captureException } from '../common/sentry.util';
import { nextStreakState } from '../common/streak.util';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private influenceService: InfluenceService,
    private ownershipService: OwnershipService,
    private feedService: FeedService,
    private anticheatService: AnticheatService,
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
      return;
    }

    const h3Module = await import('h3-js');
    const h3 = h3Module.default || h3Module;
    const previewCells = new Set<string>();
    for (const point of track) {
      previewCells.add(h3.latLngToCell(point.lat, point.lng, 9));
    }
    const previewIndices = [...previewCells];
    const previousOwners = await this.ownershipService.snapshotOwners(previewIndices);

    const beforeOwnership = await this.prisma.cellOwnership.findMany({
      where: { userId: activity.userId, h3Index: { in: previewIndices } },
      select: { h3Index: true, influence: true },
    });
    const influenceBefore = new Map(
      beforeOwnership.map((row) => [row.h3Index, row.influence]),
    );

    const affectedCells = await this.influenceService.processTrack(activity.userId, track);
    const ownerResults = await this.ownershipService.recalculateOwners(
      affectedCells,
      previousOwners,
    );

    const afterOwnership = await this.prisma.cellOwnership.findMany({
      where: { userId: activity.userId, h3Index: { in: affectedCells } },
      select: { h3Index: true, influence: true },
    });
    const influenceAfter = new Map(
      afterOwnership.map((row) => [row.h3Index, row.influence]),
    );

    let newCellsCount = 0;
    let influenceGained = 0;
    for (const h3Index of affectedCells) {
      const before = influenceBefore.get(h3Index) ?? 0;
      const after = influenceAfter.get(h3Index) ?? 0;
      if (before <= 0 && after > 0) newCellsCount += 1;
      influenceGained += Math.max(0, after - before);
    }

    let capturedCellsCount = 0;
    for (const result of ownerResults) {
      const prevOwner = previousOwners.get(result.h3Index) ?? null;
      if (result.ownerId === activity.userId && prevOwner !== activity.userId) {
        capturedCellsCount += 1;
      }
    }

    await this.redisService.set(
      `activity_result:${activityId}`,
      JSON.stringify({
        newCellsCount,
        capturedCellsCount,
        influenceGained,
        affectedH3Indices: affectedCells,
        distanceMeters: activity.distanceMeters,
      }),
      3600,
    );

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
      data: {
        status: ActivityStatus.completed,
        processedAt: new Date(),
      },
    });

    this.logger.log({
      msg: 'Activity processed successfully',
      activityId,
      userId: activity.userId,
      cellsAffected: affectedCells.length,
    });
  }
}
