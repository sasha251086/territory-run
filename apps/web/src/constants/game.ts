/** Keep in sync with apps/api/src/common/constants.ts */

export const INFLUENCE_DISPLAY_SCALE = 100;
export const MAX_INFLUENCE_PER_CELL = 10_000;
export const MAX_INFLUENCE_DISPLAY = MAX_INFLUENCE_PER_CELL / INFLUENCE_DISPLAY_SCALE;
export const BASE_INFLUENCE = 100;
export const HOME_ZONE_RADIUS_M = 350;
export const HOME_ZONE_BONUS_MULTIPLIER = 1.25;
export const SOFT_CAP_CELLS = 80;
export const SOFT_CAP_INFLUENCE_MULTIPLIER = 0.5;
export const DECAY_RATE_PER_DAY = 0.98;
export const DECAY_PERCENT_PER_DAY = Math.round((1 - DECAY_RATE_PER_DAY) * 100);
export const DECAY_DELETE_AFTER_DAYS = 60;
export const DECAY_GRACE_DAYS = 7;
export const SEASON_DURATION_DAYS = 45;
export const DECAY_WARNING_DAYS = DECAY_GRACE_DAYS;
export const DECAY_THREAT_DAYS = 10;
export const MIN_ACTIVITY_DISTANCE_M = 100;
export const MIN_CELL_DISTANCE_M = 50;
export const MAX_INFLUENCE_GAIN_MULTIPLIER = 1.5;
export const CAPTURE_TARGET_EXPAND_LIMIT = 5;

export function streakMultiplier(streak: number): number {
  if (streak >= 14) return 1.3;
  if (streak >= 7) return 1.2;
  if (streak >= 4) return 1.1;
  return 1.0;
}

export function streakBonusLabel(streak: number): string {
  const mult = streakMultiplier(streak);
  if (mult <= 1) {
    return 'бонус ×1';
  }
  return `бонус ×${mult.toFixed(1)}`;
}

export function displayInfluence(internal: number): number {
  return Math.round(internal / INFLUENCE_DISPLAY_SCALE);
}

/** Influence lost on next decay tick for this cell (−2% of current). */
export function dailyDecayLossFromInfluence(influence: number): number {
  if (influence <= 0) {
    return 0;
  }
  const next = Math.floor(influence * DECAY_RATE_PER_DAY);
  return influence - next;
}

/** @deprecated Alias for displayInfluence — same full internal scale. */
export function mapCellInfluenceLabel(internal: number): number {
  return displayInfluence(internal);
}

export function softCapLabel(cellsOwned: number): string {
  if (cellsOwned >= SOFT_CAP_CELLS) {
    return `${cellsOwned} / ${SOFT_CAP_CELLS} · прирост ×${SOFT_CAP_INFLUENCE_MULTIPLIER}`;
  }
  return `${cellsOwned} / ${SOFT_CAP_CELLS} клеток`;
}

export function influenceGainHint(summary: {
  influencePerRun?: number;
  effectiveInfluenceMultiplier?: number;
  influenceMultiplierCapped?: boolean;
  atSoftCap?: boolean;
  locationMultiplier?: number;
  streakMultiplier?: number;
  softCapMultiplier?: number;
} | null): string | null {
  if (!summary?.influencePerRun) {
    return null;
  }
  const perRun = displayInfluence(summary.influencePerRun);
  const parts = [`≈ +${perRun} за пробежку в клетке (≥${MIN_CELL_DISTANCE_M} м)`];

  const bonuses: string[] = [];
  if (summary.locationMultiplier && summary.locationMultiplier > 1) {
    bonuses.push(`дом ×${summary.locationMultiplier.toFixed(2)}`);
  }
  if (summary.streakMultiplier && summary.streakMultiplier > 1) {
    bonuses.push(`стрик ×${summary.streakMultiplier.toFixed(1)}`);
  }
  if (summary.atSoftCap || (summary.softCapMultiplier && summary.softCapMultiplier < 1)) {
    bonuses.push(`soft cap ×${SOFT_CAP_INFLUENCE_MULTIPLIER}`);
  }
  if (summary.influenceMultiplierCapped) {
    bonuses.push(`потолок ×${MAX_INFLUENCE_GAIN_MULTIPLIER}`);
  }
  if (bonuses.length > 0) {
    parts.push(bonuses.join(' · '));
  }
  return parts.join(' · ');
}
