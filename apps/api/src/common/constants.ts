/** Internal storage scale: UI shows values ÷ INFLUENCE_DISPLAY_SCALE (e.g. 7800 → 78). */
export const INFLUENCE_DISPLAY_SCALE = 100;

export const MAX_INFLUENCE_PER_CELL = 10_000;
export const BASE_INFLUENCE = 100;
export const HOME_ZONE_BONUS_MULTIPLIER = 1.25;
export const HOME_ZONE_RADIUS_M = 350;
export const NEW_PLAYER_BONUS_MULTIPLIER = 1.25;
export const NEW_PLAYER_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Maximum allowed running speed: 28 km/h in m/s */
export const MAX_RUN_SPEED_MS = 28 / 3.6;

/** Cap on stacked location × streak × soft-cap multipliers per cell visit. */
export const MAX_INFLUENCE_GAIN_MULTIPLIER = 1.5;

export const KING_CLAIM_THRESHOLD = 0.6;
export const KING_LOSS_THRESHOLD = 0.5;

/** Multiplier applied daily after grace period (influence × rate = −2% loss). */
export const DECAY_RATE_PER_DAY = 0.98;
export const DECAY_DELETE_AFTER_DAYS = 60;
/** No decay for this many days after last run through the cell. */
export const DECAY_GRACE_DAYS = 7;
export const DECAY_WARNING_DAYS = DECAY_GRACE_DAYS;
export const DECAY_THREAT_DAYS = 10;

/** Territory freeze (grace period) while user is away. */
export const FREEZE_DURATION_DAYS = 7;
export const FREEZE_COOLDOWN_DAYS = 90;

/** Capture target hints: gap to leader within this range = easy capture. */
export const CAPTURE_TARGET_MAX_GAP = 1_500;
export const CAPTURE_TARGET_FINISH_GAP = 500;
export const CAPTURE_TARGET_RADIUS_M = 2000;
/** Max neutral expand targets to suggest near player. */
export const CAPTURE_TARGET_EXPAND_LIMIT = 5;

/** Minimum valid activity distance (meters). */
export const MIN_ACTIVITY_DISTANCE_M = 100;

/** Minimum track distance inside a cell for full influence gain. */
export const MIN_CELL_DISTANCE_M = 50;

export const MAX_RIVAL_FOLLOWS = 3;

/** Notify cell owner when challenger's influence reaches this fraction of owner's. */
export const SIEGE_THRESHOLD = 0.8;
export const SIEGE_EVENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Contested cell: gap to 2nd place within this absolute influence. */
export const CONTEST_GAP_ABSOLUTE = 100;
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

export function roundInfluence(value: number): number {
  return Math.round(value);
}

/** Influence lost on one decay tick (−2% of current, min 1 if influence > 0). */
export function decayLossAmount(influence: number): number {
  if (influence <= 0) {
    return 0;
  }
  const next = Math.floor(influence * DECAY_RATE_PER_DAY);
  return influence - next;
}

export function applyDailyDecay(influence: number): number {
  if (influence <= 0) {
    return 0;
  }
  return Math.floor(influence * DECAY_RATE_PER_DAY);
}

export function displayInfluence(internal: number): number {
  return Math.round(internal / INFLUENCE_DISPLAY_SCALE);
}
