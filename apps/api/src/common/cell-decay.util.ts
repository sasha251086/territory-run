import {
  BASE_INFLUENCE,
  DECAY_CRITICAL_DAYS,
  DECAY_DELETE_AFTER_DAYS,
  DECAY_WARNING_DAYS,
} from './constants';

export type DecayRisk = 'none' | 'warning' | 'critical';

export function daysSinceActivity(lastActivityAt: Date | null | undefined): number | null {
  if (!lastActivityAt) return null;
  return Math.floor((Date.now() - lastActivityAt.getTime()) / (24 * 60 * 60 * 1000));
}

export function decayRiskFor(lastActivityAt: Date | null | undefined): DecayRisk {
  const days = daysSinceActivity(lastActivityAt);
  if (days == null) return 'none';
  if (days >= DECAY_CRITICAL_DAYS && days < DECAY_DELETE_AFTER_DAYS) return 'critical';
  if (days >= DECAY_WARNING_DAYS && days < DECAY_CRITICAL_DAYS) return 'warning';
  return 'none';
}

export function runsToCapture(gap: number): number {
  if (gap <= 0) return 0;
  return Math.ceil(gap / BASE_INFLUENCE);
}
