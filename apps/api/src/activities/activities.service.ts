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
import { distanceMetersByH3Cell } from '../common/track-distance.util';
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
          cellsCaptured: true,
          cellsTouched: true,
          newCellsCaptured: true,
          pvpCaptures: true,
          influenceAdded: true,
        },
      }),
      this.prisma.activity.count({ where: { userId } }),
    ]);

    const needsFallbackIds = items
      .filter((item) => this.needsResultFallback(item))
      .map((item) => item.id);

    const feedByActivityId = await this.loadFeedResultsForActivities(
      userId,
      needsFallbackIds,
    );

    const stillMissingIds = needsFallbackIds.filter((id) => !feedByActivityId.has(id));
    const trackByActivityId = await this.loadTrackCellCounts(stillMissingIds);

    const enrichedItems = items.map((item) => {
      const feed = feedByActivityId.get(item.id);
      const track = trackByActivityId.get(item.id);
      const resolved = this.resolveActivityResults(item, feed, track);
      this.persistResolvedResultsIfNeeded(item.id, item, resolved);
      return { ...item, ...resolved };
    });

    return {
      items: enrichedItems,
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
        distanceMeters: true,
        durationSeconds: true,
        cellsCaptured: true,
        cellsTouched: true,
        newCellsCaptured: true,
        pvpCaptures: true,
        influenceAdded: true,
      },
    });

    if (!activity) {
      throw new ApiException(
        ErrorCodes.NOT_FOUND,
        'Activity not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const feedFallback = this.needsResultFallback(activity)
      ? (await this.loadFeedResultsForActivities(userId, [activityId])).get(activityId)
      : undefined;

    const trackFallback =
      this.needsResultFallback(activity) && !feedFallback
        ? (await this.loadTrackCellCounts([activityId])).get(activityId)
        : undefined;

    const resolved = this.resolveActivityResults(activity, feedFallback, trackFallback);
    this.persistResolvedResultsIfNeeded(activityId, activity, resolved);

    return {
      status: activity.status,
      ...(activity.failureReason ? { reason: activity.failureReason } : {}),
      ...(activity.status === ActivityStatus.completed
        ? {
            distanceMeters: activity.distanceMeters,
            durationSeconds: activity.durationSeconds,
            cellsCaptured: resolved.cellsCaptured ?? 0,
            cellsTouched: resolved.cellsTouched ?? 0,
            newCellsCaptured: activity.newCellsCaptured ?? 0,
            pvpCaptures: resolved.pvpCaptures ?? activity.pvpCaptures ?? 0,
            influenceAdded: resolved.influenceAdded ?? activity.influenceAdded ?? 0,
          }
        : {}),
    };
  }

  async getById(userId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, userId },
      include: { track: true },
    });

    if (!activity) {
      throw new ApiException(
        ErrorCodes.NOT_FOUND,
        'Activity not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const route = activity.track?.route as
      | { lat: number; lng: number }[]
      | undefined;

    let bounds: { north: number; south: number; east: number; west: number } | null =
      null;
    if (route?.length) {
      let north = route[0].lat;
      let south = route[0].lat;
      let east = route[0].lng;
      let west = route[0].lng;
      for (const point of route) {
        north = Math.max(north, point.lat);
        south = Math.min(south, point.lat);
        east = Math.max(east, point.lng);
        west = Math.min(west, point.lng);
      }
      bounds = { north, south, east, west };
    }

    return {
      id: activity.id,
      source: activity.source,
      distanceMeters: activity.distanceMeters,
      durationSeconds: activity.durationSeconds,
      avgPace: activity.avgPace,
      startedAt: activity.startedAt,
      finishedAt: activity.finishedAt,
      status: activity.status,
      failureReason: activity.failureReason,
      processedAt: activity.processedAt,
      cellsCaptured: activity.cellsCaptured,
      cellsTouched: activity.cellsTouched,
      newCellsCaptured: activity.newCellsCaptured,
      pvpCaptures: activity.pvpCaptures,
      influenceAdded: activity.influenceAdded,
      bounds,
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

  private needsResultFallback(item: {
    status: ActivityStatus | string;
    cellsCaptured: number | null;
    cellsTouched: number | null;
  }): boolean {
    if (item.status !== ActivityStatus.completed) {
      return false;
    }
    if (item.cellsCaptured == null || item.cellsTouched == null) {
      return true;
    }
    return item.cellsCaptured === 0 && item.cellsTouched === 0;
  }

  private resolveActivityResults(
    item: {
      status: ActivityStatus | string;
      cellsCaptured: number | null;
      cellsTouched: number | null;
      pvpCaptures: number | null;
      influenceAdded: number | null;
    },
    feed?: {
      cellsCaptured?: number;
      cellsTouched?: number;
      pvpCaptures?: number;
      influenceAdded?: number;
    },
    track?: { cellsTouched: number },
  ) {
    if (item.status === ActivityStatus.failed) {
      return {
        cellsCaptured: 0,
        cellsTouched: 0,
        pvpCaptures: item.pvpCaptures,
        influenceAdded: item.influenceAdded,
      };
    }
    if (item.status !== ActivityStatus.completed) {
      return {
        cellsCaptured: null as number | null,
        cellsTouched: null as number | null,
        pvpCaptures: item.pvpCaptures,
        influenceAdded: item.influenceAdded,
      };
    }

    const feedCaptured = feed?.cellsCaptured;
    const feedTouched = feed?.cellsTouched;
    const trackTouched = track?.cellsTouched;

    let cellsTouched = item.cellsTouched ?? feedTouched ?? trackTouched ?? null;
    let cellsCaptured = item.cellsCaptured ?? feedCaptured ?? trackTouched ?? null;

    if (feedCaptured != null && (cellsCaptured == null || cellsCaptured < feedCaptured)) {
      cellsCaptured = feedCaptured;
    }
    if (feedTouched != null && (cellsTouched == null || cellsTouched < feedTouched)) {
      cellsTouched = feedTouched;
    }

    return {
      cellsCaptured,
      cellsTouched,
      pvpCaptures: item.pvpCaptures ?? feed?.pvpCaptures ?? item.pvpCaptures,
      influenceAdded: item.influenceAdded ?? feed?.influenceAdded ?? item.influenceAdded,
    };
  }

  private persistResolvedResultsIfNeeded(
    activityId: string,
    stored: {
      cellsCaptured: number | null;
      cellsTouched: number | null;
      pvpCaptures: number | null;
      influenceAdded: number | null;
    },
    resolved: {
      cellsCaptured: number | null;
      cellsTouched: number | null;
      pvpCaptures: number | null;
      influenceAdded: number | null;
    },
  ) {
    const data: {
      cellsCaptured?: number;
      cellsTouched?: number;
      pvpCaptures?: number;
      influenceAdded?: number;
    } = {};

    if (
      resolved.cellsCaptured != null &&
      (stored.cellsCaptured == null || stored.cellsCaptured < resolved.cellsCaptured)
    ) {
      data.cellsCaptured = resolved.cellsCaptured;
    }
    if (
      resolved.cellsTouched != null &&
      (stored.cellsTouched == null || stored.cellsTouched < resolved.cellsTouched)
    ) {
      data.cellsTouched = resolved.cellsTouched;
    }
    if (
      resolved.pvpCaptures != null &&
      (stored.pvpCaptures == null || stored.pvpCaptures < resolved.pvpCaptures)
    ) {
      data.pvpCaptures = resolved.pvpCaptures;
    }
    if (
      resolved.influenceAdded != null &&
      (stored.influenceAdded == null || stored.influenceAdded < resolved.influenceAdded)
    ) {
      data.influenceAdded = resolved.influenceAdded;
    }

    if (Object.keys(data).length === 0) {
      return;
    }

    void this.prisma.activity
      .update({ where: { id: activityId }, data })
      .catch(() => undefined);
  }

  /** Fallback for activities processed before cellsCaptured/cellsTouched columns existed. */
  private async loadFeedResultsForActivities(userId: string, activityIds: string[]) {
    const map = new Map<
      string,
      {
        cellsCaptured?: number;
        cellsTouched?: number;
        pvpCaptures?: number;
        influenceAdded?: number;
      }
    >();

    if (activityIds.length === 0) {
      return map;
    }

    const wanted = new Set(activityIds);
    const events = await this.prisma.event.findMany({
      where: { userId, type: 'activity_completed' },
      select: { payload: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const activityId = payload.activityId;
      if (typeof activityId !== 'string' || !wanted.has(activityId) || map.has(activityId)) {
        continue;
      }

      const cellsTouched = Number(payload.cellsAffected ?? payload.cellsTouched ?? 0);
      const cellsCapturedRaw = payload.cellsCaptured;
      const cellsCaptured =
        cellsCapturedRaw != null ? Number(cellsCapturedRaw) : undefined;

      map.set(activityId, {
        cellsTouched: cellsTouched > 0 ? cellsTouched : undefined,
        cellsCaptured: cellsCaptured != null && cellsCaptured >= 0 ? cellsCaptured : undefined,
        pvpCaptures:
          payload.pvpCaptures != null ? Number(payload.pvpCaptures) : undefined,
        influenceAdded:
          payload.influenceAdded != null ? Number(payload.influenceAdded) : undefined,
      });
    }

    return map;
  }

  private async loadTrackCellCounts(activityIds: string[]) {
    const map = new Map<string, { cellsTouched: number }>();
    if (activityIds.length === 0) {
      return map;
    }

    const rows = await this.prisma.activity.findMany({
      where: { id: { in: activityIds }, status: ActivityStatus.completed },
      select: {
        id: true,
        track: { select: { route: true } },
      },
    });

    for (const row of rows) {
      const route = row.track?.route as
        | { lat: number; lng: number; timestamp?: string }[]
        | undefined;
      if (!route?.length) {
        continue;
      }
      const sanitized = sanitizeTrackPoints(route);
      if (sanitized.length < 2) {
        continue;
      }
      const count = distanceMetersByH3Cell(sanitized).size;
      if (count > 0) {
        map.set(row.id, { cellsTouched: count });
      }
    }

    return map;
  }
}
