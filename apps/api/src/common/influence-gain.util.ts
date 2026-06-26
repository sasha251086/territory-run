import {
  BASE_INFLUENCE,
  HOME_ZONE_BONUS_MULTIPLIER,
  HOME_ZONE_RADIUS_M,
  MAX_INFLUENCE_GAIN_MULTIPLIER,
  NEW_PLAYER_BONUS_MULTIPLIER,
  NEW_PLAYER_PERIOD_MS,
  SOFT_CAP_CELLS,
  SOFT_CAP_INFLUENCE_MULTIPLIER,
  streakMultiplier,
} from './constants';
import { haversineDistance } from './geo.util';

export type InfluenceGainContext = {
  homeLat: number | null;
  homeLng: number | null;
  createdAt: Date;
  currentStreak: number;
  cellsOwned: number;
  /** When estimating capture runs, assume home-zone cell. */
  assumeHomeZone?: boolean;
};

export function locationInfluenceMultiplier(
  user: Pick<InfluenceGainContext, 'homeLat' | 'homeLng' | 'createdAt'>,
  center: { lat: number; lng: number },
  hasExistingOwnership: boolean,
): number {
  const inHome =
    user.homeLat != null &&
    user.homeLng != null &&
    haversineDistance(user.homeLat, user.homeLng, center.lat, center.lng) <= HOME_ZONE_RADIUS_M;

  if (inHome) {
    return HOME_ZONE_BONUS_MULTIPLIER;
  }

  if (!hasExistingOwnership && Date.now() - user.createdAt.getTime() < NEW_PLAYER_PERIOD_MS) {
    return NEW_PLAYER_BONUS_MULTIPLIER;
  }

  return 1;
}

export function capInfluenceGainMultiplier(raw: number): number {
  return Math.min(raw, MAX_INFLUENCE_GAIN_MULTIPLIER);
}

export function softCapMultiplier(cellsOwned: number): number {
  return cellsOwned >= SOFT_CAP_CELLS ? SOFT_CAP_INFLUENCE_MULTIPLIER : 1;
}

export function estimateInfluencePerRun(ctx: InfluenceGainContext): number {
  return describeInfluenceGain(ctx).perRun;
}

export type InfluenceGainSummary = {
  perRun: number;
  rawMultiplier: number;
  effectiveMultiplier: number;
  multiplierCapped: boolean;
  atSoftCap: boolean;
  locationMultiplier: number;
  streakMultiplier: number;
  softCapMultiplier: number;
};

export function describeInfluenceGain(ctx: InfluenceGainContext): InfluenceGainSummary {
  const center =
    ctx.homeLat != null && ctx.homeLng != null
      ? { lat: ctx.homeLat, lng: ctx.homeLng }
      : { lat: 0, lng: 0 };

  const locationMult = ctx.assumeHomeZone
    ? HOME_ZONE_BONUS_MULTIPLIER
    : locationInfluenceMultiplier(ctx, center, false);

  const streakMult = streakMultiplier(ctx.currentStreak);
  const softCapMult = softCapMultiplier(ctx.cellsOwned);
  const rawMultiplier = locationMult * streakMult * softCapMult;
  const effectiveMultiplier = capInfluenceGainMultiplier(rawMultiplier);

  return {
    perRun: BASE_INFLUENCE * effectiveMultiplier,
    rawMultiplier,
    effectiveMultiplier,
    multiplierCapped: rawMultiplier > MAX_INFLUENCE_GAIN_MULTIPLIER + 1e-6,
    atSoftCap: ctx.cellsOwned >= SOFT_CAP_CELLS,
    locationMultiplier: locationMult,
    streakMultiplier: streakMult,
    softCapMultiplier: softCapMult,
  };
}
