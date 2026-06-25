export const MAX_INFLUENCE_PER_CELL = 100;
export const BASE_INFLUENCE = 1;
export const HOME_ZONE_BONUS_MULTIPLIER = 1.25;
export const HOME_ZONE_RADIUS_M = 350;
export const NEW_PLAYER_BONUS_MULTIPLIER = 1.25;
export const NEW_PLAYER_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Maximum allowed running speed: 40 km/h in m/s */
export const MAX_RUN_SPEED_MS = 40 / 3.6;

export const KING_CLAIM_THRESHOLD = 0.6;
export const KING_LOSS_THRESHOLD = 0.5;

/** Daily influence decay multiplier (see DecayService). */
export const DECAY_RATE_PER_DAY = 0.98;
export const DECAY_DELETE_AFTER_DAYS = 45;
export const DECAY_WARNING_DAYS = 7;
export const DECAY_THREAT_DAYS = 10;

/** Territory freeze (grace period) while user is away. */
export const FREEZE_DURATION_DAYS = 7;
export const FREEZE_COOLDOWN_DAYS = 90;

/** Capture target hints: gap to leader within this range = easy capture. */
export const CAPTURE_TARGET_MAX_GAP = 15;
export const CAPTURE_TARGET_FINISH_GAP = 5;
export const CAPTURE_TARGET_RADIUS_M = 2000;

/** Minimum valid activity distance (meters). */
export const MIN_ACTIVITY_DISTANCE_M = 100;

/** Minimum track distance inside a cell for full +1 influence. */
export const MIN_CELL_DISTANCE_M = 50;

export const MAX_RIVAL_FOLLOWS = 3;

/** Notify cell owner when challenger's influence reaches this fraction of owner's. */
export const SIEGE_THRESHOLD = 0.8;
export const SIEGE_EVENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Contested cell: gap to 2nd place within this absolute influence. */
export const CONTEST_GAP_ABSOLUTE = 1;
/** Contested cell: gap within this fraction of leader influence. */
export const CONTEST_GAP_RELATIVE = 0.1;

/** Season competition cycle length in days. Territory is not reset — only season score. */
export const SEASON_DURATION_DAYS = 45;

/** Soft cap: above this many owned cells, influence gain is reduced. */
export const SOFT_CAP_CELLS = 80;
export const SOFT_CAP_INFLUENCE_MULTIPLIER = 0.5;

/** Streak resets after this many calendar days without a run. */
export const STREAK_BREAK_DAYS = 2;

export function streakMultiplier(streak: number): number {
  if (streak >= 14) return 1.3;
  if (streak >= 7) return 1.2;
  if (streak >= 4) return 1.1;
  return 1.0;
}
