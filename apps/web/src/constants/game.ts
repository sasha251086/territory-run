/** Keep in sync with apps/api/src/common/constants.ts */

export const HOME_ZONE_RADIUS_M = 350;
export const HOME_ZONE_BONUS_MULTIPLIER = 1.25;
export const MAX_INFLUENCE_PER_CELL = 100;
export const BASE_INFLUENCE = 1;
export const SOFT_CAP_CELLS = 80;
export const SOFT_CAP_INFLUENCE_MULTIPLIER = 0.5;
export const DECAY_RATE_PER_DAY = 0.98;
export const DECAY_DELETE_AFTER_DAYS = 45;
export const DECAY_WARNING_DAYS = 7;
export const DECAY_THREAT_DAYS = 10;
export const MIN_ACTIVITY_DISTANCE_M = 100;
export const MIN_CELL_DISTANCE_M = 50;
export const STREAK_BREAK_DAYS = 2;

export function streakMultiplier(streak: number): number {
  if (streak >= 14) return 1.3;
  if (streak >= 7) return 1.2;
  if (streak >= 4) return 1.1;
  return 1.0;
}

export function streakBonusLabel(streak: number): string {
  const mult = streakMultiplier(streak);
  if (mult <= 1) {
    return '×1.0';
  }
  return `×${mult.toFixed(1)}`;
}

export function softCapLabel(cellsOwned: number): string {
  if (cellsOwned >= SOFT_CAP_CELLS) {
    return `${cellsOwned} / ${SOFT_CAP_CELLS} · влияние ×${SOFT_CAP_INFLUENCE_MULTIPLIER}`;
  }
  return `${cellsOwned} / ${SOFT_CAP_CELLS} клеток`;
}
