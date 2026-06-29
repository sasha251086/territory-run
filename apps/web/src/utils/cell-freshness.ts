import { DECAY_GRACE_DAYS, DECAY_THREAT_DAYS } from '../constants/game';
import type { FreshnessStatus } from './cell-lifespan';

export function daysSinceActivity(
  lastActivityAt: Date | string | null | undefined,
): number | null {
  if (!lastActivityAt) return null;
  const ms =
    typeof lastActivityAt === 'string'
      ? new Date(lastActivityAt).getTime()
      : lastActivityAt.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
}

/** Matches apps/api/src/common/cell-decay.util.ts */
export function freshnessStatus(
  lastActivityAt: Date | string | null | undefined,
): FreshnessStatus {
  const days = daysSinceActivity(lastActivityAt);
  if (days == null || days < DECAY_GRACE_DAYS) return 'fresh';
  if (days >= DECAY_THREAT_DAYS) return 'critical';
  return 'warning';
}
