import { Injectable } from '@nestjs/common';
import { MAX_RUN_SPEED_MS, MIN_ACTIVITY_DISTANCE_M } from '../common/constants';
import { MIN_SPEED_CHECK_INTERVAL_SECONDS } from '../common/track.util';
import { haversineDistance } from '../common/geo.util';

export type TrackPoint = {
  lat: number;
  lng: number;
  timestamp?: string;
};

export type AnticheatFailureReason =
  | 'INSUFFICIENT_POINTS'
  | 'SPEED_EXCEEDED'
  | 'GPS_ANOMALY'
  | 'DISTANCE_MISMATCH'
  | 'DISTANCE_TOO_SHORT';

export type AnticheatResult =
  | { valid: true }
  | { valid: false; reason: AnticheatFailureReason };

@Injectable()
export class AnticheatService {
  validateTrack(track: TrackPoint[]): AnticheatResult {
    if (track.length < 2) {
      return { valid: false, reason: 'INSUFFICIENT_POINTS' };
    }

    for (let i = 1; i < track.length; i++) {
      const prev = track[i - 1];
      const curr = track[i];

      if (!prev.timestamp || !curr.timestamp) {
        return { valid: false, reason: 'GPS_ANOMALY' };
      }

      const timePrev = new Date(prev.timestamp).getTime();
      const timeCurr = new Date(curr.timestamp).getTime();

      if (Number.isNaN(timePrev) || Number.isNaN(timeCurr)) {
        return { valid: false, reason: 'GPS_ANOMALY' };
      }

      const distanceMeters = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      const deltaSeconds = (timeCurr - timePrev) / 1000;

      if (deltaSeconds <= 0 && distanceMeters > 0) {
        return { valid: false, reason: 'GPS_ANOMALY' };
      }

      if (deltaSeconds <= 0) {
        continue;
      }

      if (deltaSeconds < MIN_SPEED_CHECK_INTERVAL_SECONDS) {
        continue;
      }

      const speedMs = distanceMeters / deltaSeconds;
      if (speedMs > MAX_RUN_SPEED_MS) {
        return { valid: false, reason: 'SPEED_EXCEEDED' };
      }
    }

    return { valid: true };
  }

  validateMinimumDistance(
    trackDistanceMeters: number,
    claimedDistanceMeters: number,
  ): AnticheatResult {
    const effectiveDistance = Math.max(trackDistanceMeters, claimedDistanceMeters);
    if (effectiveDistance < MIN_ACTIVITY_DISTANCE_M) {
      return { valid: false, reason: 'DISTANCE_TOO_SHORT' };
    }
    return { valid: true };
  }

  validateClaimedDistance(
    actualDistanceMeters: number,
    claimedDistanceMeters: number,
    tolerance = 0.2,
  ): AnticheatResult {
    if (claimedDistanceMeters <= 0 || actualDistanceMeters <= 0) {
      return { valid: true };
    }

    const maxAllowed = actualDistanceMeters * (1 + tolerance);
    if (claimedDistanceMeters > maxAllowed) {
      return { valid: false, reason: 'DISTANCE_MISMATCH' };
    }

    return { valid: true };
  }
}
