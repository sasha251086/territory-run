import { MAX_RUN_SPEED_MS } from './constants';
import { haversineDistance } from './geo.util';

export type TimestampedPoint = {
  lat: number;
  lng: number;
  timestamp?: string;
};

/** Gaps shorter than this are treated as GPS batching noise in speed checks. */
export const MIN_SPEED_CHECK_INTERVAL_SECONDS = 1;

/**
 * Removes duplicate timestamps and GPS spike points that commonly appear
 * in Samsung Health exports (sub-second samples, coordinate jumps).
 */
export function sanitizeTrackPoints<T extends TimestampedPoint>(points: T[]): T[] {
  if (points.length < 2) return points;

  const cleaned: T[] = [];

  for (const point of points) {
    if (!point.timestamp) continue;
    if (Number.isNaN(new Date(point.timestamp).getTime())) continue;

    if (cleaned.length === 0) {
      cleaned.push(point);
      continue;
    }

    const prev = cleaned[cleaned.length - 1];
    const timePrev = new Date(prev.timestamp!).getTime();
    const timeCurr = new Date(point.timestamp!).getTime();
    const deltaSeconds = (timeCurr - timePrev) / 1000;

    if (deltaSeconds <= 0) continue;

    if (deltaSeconds >= MIN_SPEED_CHECK_INTERVAL_SECONDS) {
      const distanceMeters = haversineDistance(prev.lat, prev.lng, point.lat, point.lng);
      const speedMs = distanceMeters / deltaSeconds;
      if (speedMs > MAX_RUN_SPEED_MS) continue;
    }

    cleaned.push(point);
  }

  return cleaned.length >= 2 ? cleaned : points;
}
