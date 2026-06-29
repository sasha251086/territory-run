import {
  BASE_INFLUENCE,
  decayLossAmount,
  DECAY_DELETE_AFTER_DAYS,
  DECAY_GRACE_DAYS,
  DECAY_THREAT_DAYS,
  DECAY_WARNING_DAYS,
  displayInfluence,
} from './constants';

export type DecayRisk = 'none' | 'warning' | 'critical';
export type FreshnessStatus = 'fresh' | 'warning' | 'critical';
export type ActivityDateInput = Date | string | number | null | undefined;

export function daysSinceActivity(lastActivityAt: ActivityDateInput): number | null {
  const at = coerceActivityDate(lastActivityAt);
  if (!at) return null;
  return Math.floor((Date.now() - at.getTime()) / (24 * 60 * 60 * 1000));
}

export function coerceActivityDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function freshnessStatus(
  lastActivityAt: ActivityDateInput,
): FreshnessStatus {
  const days = daysSinceActivity(lastActivityAt);
  if (days == null || days < DECAY_GRACE_DAYS) return 'fresh';
  if (days >= DECAY_THREAT_DAYS) return 'critical';
  return 'warning';
}

export function decayRiskFor(lastActivityAt: ActivityDateInput): DecayRisk {
  const status = freshnessStatus(lastActivityAt);
  if (status === 'critical') return 'critical';
  if (status === 'warning') return 'warning';
  return 'none';
}

export function daysUntilWipe(lastActivityAt: ActivityDateInput): number | null {
  const days = daysSinceActivity(lastActivityAt);
  if (days == null) return null;
  return Math.max(0, DECAY_DELETE_AFTER_DAYS - days);
}

/** Internal influence units lost on next daily decay tick (0 if cell is fresh). */
export function dailyDecayLoss(
  influence: number,
  lastActivityAt: ActivityDateInput,
): number {
  if (freshnessStatus(lastActivityAt) === 'fresh' || influence <= 0) {
    return 0;
  }
  return decayLossAmount(influence);
}

export type CellLifespanSummary = {
  daysSinceActivity: number | null;
  freshness: FreshnessStatus;
  decayRisk: DecayRisk;
  dailyLossInternal: number;
  dailyLossDisplay: number;
  daysUntilWipe: number | null;
};

export function describeCellLifespan(
  influence: number,
  lastActivityAt: ActivityDateInput,
): CellLifespanSummary {
  const days = daysSinceActivity(lastActivityAt);
  const freshness = freshnessStatus(lastActivityAt);
  const dailyLossInternal = dailyDecayLoss(influence, lastActivityAt);
  return {
    daysSinceActivity: days,
    freshness,
    decayRisk: decayRiskFor(lastActivityAt),
    dailyLossInternal,
    dailyLossDisplay: displayInfluence(dailyLossInternal),
    daysUntilWipe: daysUntilWipe(lastActivityAt),
  };
}

export function runsToCapture(gap: number, effectiveGain = BASE_INFLUENCE): number {
  if (gap <= 0 || effectiveGain <= 0) {
    return 0;
  }
  return Math.ceil(gap / effectiveGain);
}
