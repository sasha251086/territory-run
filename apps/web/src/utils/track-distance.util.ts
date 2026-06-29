import * as h3 from 'h3-js';
import { haversineKm } from './geo';

const H3_RESOLUTION = 9;

export type RoutePoint = { lat: number; lng: number };

/** Normalize GPS track points from API (lat/lng or latitude/longitude). */
export function normalizeRoutePoints(raw: unknown): RoutePoint[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const points: RoutePoint[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const lat = record.lat ?? record.latitude;
    const lng = record.lng ?? record.lon ?? record.longitude;
    if (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      points.push({ lat, lng });
    }
  }
  return points;
}

/** Accumulate meters run inside each H3 cell from track segments. */
export function distanceMetersByH3Cell(track: RoutePoint[]): Map<string, number> {
  const distanceByH3 = new Map<string, number>();

  if (track.length === 0) {
    return distanceByH3;
  }

  if (track.length === 1) {
    const cell = h3.latLngToCell(track[0].lat, track[0].lng, H3_RESOLUTION);
    distanceByH3.set(cell, 0);
    return distanceByH3;
  }

  for (let i = 1; i < track.length; i += 1) {
    const prev = track[i - 1];
    const curr = track[i];
    const segmentDist = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng) * 1000;
    if (segmentDist <= 0) {
      continue;
    }

    const prevCell = h3.latLngToCell(prev.lat, prev.lng, H3_RESOLUTION);
    const currCell = h3.latLngToCell(curr.lat, curr.lng, H3_RESOLUTION);

    if (prevCell === currCell) {
      distanceByH3.set(prevCell, (distanceByH3.get(prevCell) ?? 0) + segmentDist);
    } else {
      const half = segmentDist / 2;
      distanceByH3.set(prevCell, (distanceByH3.get(prevCell) ?? 0) + half);
      distanceByH3.set(currCell, (distanceByH3.get(currCell) ?? 0) + half);
    }
  }

  return distanceByH3;
}

export function h3IndicesFromRoute(rawRoute: unknown, serverIndices?: string[]): string[] {
  if (serverIndices?.length) {
    return serverIndices;
  }
  const route = normalizeRoutePoints(rawRoute);
  if (!route.length) {
    return [];
  }
  return [...distanceMetersByH3Cell(route).keys()];
}
