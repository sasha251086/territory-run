import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MIN_ACTIVITY_DISTANCE_M, SIEGE_EVENT_COOLDOWN_MS } from '../common/constants';

@Injectable()
export class FeedService {
  constructor(private prisma: PrismaService) {}

  async getFeed(userId: string, page: number = 1, limit: number = 20, rivalsOnly = false) {
    const skip = (page - 1) * limit;

    let rivalIds: string[] = [];
    if (rivalsOnly) {
      const follows = await this.prisma.rivalFollow.findMany({
        where: { followerId: userId },
        select: { targetUserId: true },
      });
      rivalIds = follows.map((f) => f.targetUserId);
      if (rivalIds.length === 0) {
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
    }

    const where = rivalsOnly ? { userId: { in: rivalIds } } : {};

    const fetchLimit = Math.max(limit * 8, 80);
    const events = await this.prisma.event.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: fetchLimit,
    });

    const filtered = this.dedupeFeedEvents(
      events.filter((event) => this.shouldShowInFeed(event)),
    ).slice(0, limit);

    const total = await this.prisma.event.count({ where });

    return {
      items: filtered,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Hide legacy spam and invalid activity rows from the public feed. */
  shouldShowInFeed(event: { type: string; payload: unknown }): boolean {
    const payload = (event.payload ?? {}) as Record<string, unknown>;

    if (event.type === 'cell_captured') {
      return false;
    }

    if (event.type === 'activity_completed') {
      if (payload.flagged === true) {
        return false;
      }
      const distance = Number(payload.distance ?? 0);
      if (distance > 0 && distance < MIN_ACTIVITY_DISTANCE_M) {
        return false;
      }
      const cells = Number(payload.cellsCaptured ?? payload.cellsAffected ?? 0);
      if (distance <= 0 && cells <= 0) {
        return false;
      }
      return true;
    }

    return true;
  }

  /** Collapse duplicate activity / siege rows (newest first). */
  dedupeFeedEvents<T extends { type: string; userId: string; payload: unknown }>(events: T[]): T[] {
    const seenActivities = new Set<string>();
    const seenSieges = new Set<string>();
    const result: T[] = [];

    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;

      if (event.type === 'activity_completed') {
        const activityId = payload.activityId;
        if (typeof activityId === 'string') {
          if (seenActivities.has(activityId)) {
            continue;
          }
          seenActivities.add(activityId);
        }
      }

      if (event.type === 'cell_siege') {
        const h3Index = payload.h3Index;
        const challengerUserId = payload.challengerUserId;
        if (typeof h3Index === 'string' && typeof challengerUserId === 'string') {
          const key = `${event.userId}:${h3Index}:${challengerUserId}`;
          if (seenSieges.has(key)) {
            continue;
          }
          seenSieges.add(key);
        }
      }

      result.push(event);
    }

    return result;
  }

  /** @deprecated Use dedupeFeedEvents — kept for unit tests. */
  shouldKeepInFeedPage(
    event: { type: string; userId: string; payload: unknown },
    index: number,
    list: { type: string; userId: string; payload: unknown }[],
  ): boolean {
    const payload = (event.payload ?? {}) as Record<string, unknown>;

    if (event.type === 'activity_completed') {
      const activityId = payload.activityId;
      if (typeof activityId !== 'string') {
        return true;
      }
      const firstIndex = list.findIndex((row) => {
        if (row.type !== 'activity_completed') return false;
        const rowPayload = (row.payload ?? {}) as Record<string, unknown>;
        return rowPayload.activityId === activityId;
      });
      return firstIndex === index;
    }

    if (event.type === 'cell_siege') {
      const h3Index = payload.h3Index;
      const challengerUserId = payload.challengerUserId;
      if (typeof h3Index !== 'string' || typeof challengerUserId !== 'string') {
        return true;
      }
      const firstIndex = list.findIndex((row) => {
        if (row.type !== 'cell_siege' || row.userId !== event.userId) return false;
        const rowPayload = (row.payload ?? {}) as Record<string, unknown>;
        return (
          rowPayload.h3Index === h3Index &&
          rowPayload.challengerUserId === challengerUserId
        );
      });
      return firstIndex === index;
    }

    return true;
  }

  async createEvent(type: string, userId: string, payload: Prisma.InputJsonValue) {
    return this.prisma.event.create({
      data: {
        type,
        userId,
        payload,
      },
    });
  }

  async hasRecentSiegeEvent(
    ownerId: string,
    challengerUserId: string,
    h3Index: string,
  ): Promise<boolean> {
    const since = new Date(Date.now() - SIEGE_EVENT_COOLDOWN_MS);
    const existing = await this.prisma.event.findFirst({
      where: {
        type: 'cell_siege',
        userId: ownerId,
        createdAt: { gte: since },
        AND: [
          { payload: { path: ['h3Index'], equals: h3Index } },
          { payload: { path: ['challengerUserId'], equals: challengerUserId } },
        ],
      },
      select: { id: true },
    });
    return existing != null;
  }
}
