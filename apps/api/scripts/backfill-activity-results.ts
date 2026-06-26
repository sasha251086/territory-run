/**
 * Backfill Activity.cellsCaptured / cellsTouched from feed events and GPS tracks.
 *
 * Usage (from repo root):
 *   pnpm --filter api backfill:activity-results
 */
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient, ActivityStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createPgPool } from '../src/prisma/create-pg-pool';
import { sanitizeTrackPoints } from '../src/common/track.util';
import { distanceMetersByH3Cell } from '../src/common/track-distance.util';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const pool = createPgPool();
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await prisma.$connect();

    const activities = await prisma.activity.findMany({
      where: {
        status: ActivityStatus.completed,
        OR: [
          { cellsCaptured: null },
          { cellsTouched: null },
          { cellsCaptured: 0, cellsTouched: 0 },
        ],
      },
      select: {
        id: true,
        cellsCaptured: true,
        cellsTouched: true,
        track: { select: { route: true } },
      },
    });

    if (activities.length === 0) {
      console.log('Nothing to backfill.');
      return;
    }

    const events = await prisma.event.findMany({
      where: { type: 'activity_completed' },
      select: { payload: true },
      orderBy: { createdAt: 'desc' },
    });

    const feedByActivity = new Map<
      string,
      {
        cellsCaptured?: number;
        cellsTouched?: number;
        pvpCaptures?: number;
        influenceAdded?: number;
      }
    >();

    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const activityId = payload.activityId;
      if (typeof activityId !== 'string' || feedByActivity.has(activityId)) {
        continue;
      }

      const cellsTouched = Number(payload.cellsAffected ?? payload.cellsTouched ?? 0);
      const cellsCaptured =
        payload.cellsCaptured != null ? Number(payload.cellsCaptured) : undefined;

      feedByActivity.set(activityId, {
        cellsTouched: cellsTouched > 0 ? cellsTouched : undefined,
        cellsCaptured,
        pvpCaptures: payload.pvpCaptures != null ? Number(payload.pvpCaptures) : undefined,
        influenceAdded:
          payload.influenceAdded != null ? Number(payload.influenceAdded) : undefined,
      });
    }

    let updated = 0;
    for (const activity of activities) {
      const feed = feedByActivity.get(activity.id);
      const route = activity.track?.route as
        | { lat: number; lng: number; timestamp?: string }[]
        | undefined;

      let trackTouched: number | undefined;
      if (route?.length) {
        const sanitized = sanitizeTrackPoints(route);
        if (sanitized.length >= 2) {
          const count = distanceMetersByH3Cell(sanitized).size;
          if (count > 0) {
            trackTouched = count;
          }
        }
      }

      const data: {
        cellsCaptured?: number;
        cellsTouched?: number;
        pvpCaptures?: number;
        influenceAdded?: number;
      } = {};

      if (activity.cellsCaptured == null || activity.cellsCaptured === 0) {
        if (feed?.cellsCaptured != null && feed.cellsCaptured > 0) {
          data.cellsCaptured = feed.cellsCaptured;
        } else if (activity.cellsCaptured == null && trackTouched != null) {
          data.cellsCaptured = 0;
        }
      }

      if (activity.cellsTouched == null || activity.cellsTouched === 0) {
        const touched = feed?.cellsTouched ?? trackTouched;
        if (touched != null && touched > 0) {
          data.cellsTouched = touched;
        }
      }

      if (feed?.pvpCaptures != null && feed.pvpCaptures > 0) {
        data.pvpCaptures = feed.pvpCaptures;
      }
      if (feed?.influenceAdded != null && feed.influenceAdded > 0) {
        data.influenceAdded = feed.influenceAdded;
      }

      if (Object.keys(data).length === 0) {
        continue;
      }

      await prisma.activity.update({
        where: { id: activity.id },
        data,
      });
      updated += 1;
    }

    console.log(`Backfilled ${updated} / ${activities.length} activities.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
