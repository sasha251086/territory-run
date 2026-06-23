export const MAX_INFLUENCE_PER_CELL = 100;
export const BASE_INFLUENCE = 1;
export const HOME_ZONE_BONUS_MULTIPLIER = 1.5;
export const HOME_ZONE_RADIUS_M = 500;
export const NEW_PLAYER_BONUS_MULTIPLIER = 1.25;
export const NEW_PLAYER_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Maximum allowed running speed: 40 km/h in m/s */
export const MAX_RUN_SPEED_MS = 40 / 3.6;

export const KING_CLAIM_THRESHOLD = 0.6;
export const KING_LOSS_THRESHOLD = 0.5;

/** Daily influence decay multiplier (see DecayService). */
export const DECAY_RATE_PER_DAY = 0.98;
export const DECAY_DELETE_AFTER_DAYS = 14;
export const DECAY_WARNING_DAYS = 7;
export const DECAY_THREAT_DAYS = 10;

/** Capture target hints: gap to leader within this range = easy capture. */
export const CAPTURE_TARGET_MAX_GAP = 15;
export const CAPTURE_TARGET_RADIUS_M = 2000;

export const MAX_RIVAL_FOLLOWS = 3;

/** Streak resets after this many calendar days without a run. */
export const STREAK_BREAK_DAYS = 2;

export function streakMultiplier(streak: number): number {
  if (streak >= 14) return 1.3;
  if (streak >= 7) return 1.2;
  if (streak >= 4) return 1.1;
  return 1.0;
}
