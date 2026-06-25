import * as h3 from 'h3-js';
import { haversineDistance } from './geo.util';

const H3_RESOLUTION = 9;

/** Accumulate meters run inside each H3 cell from track segments. */
export function distanceMetersByH3Cell(
  track: { lat: number; lng: number }[],
): Map<string, number> {
  const distanceByH3 = new Map<string, number>();

  if (track.length === 0) {
    return distanceByH3;
  }

  if (track.length === 1) {
    const cell = h3.latLngToCell(track[0].lat, track[0].lng, H3_RESOLUTION);
    distanceByH3.set(cell, 0);
    return distanceByH3;
  }

  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1];
    const curr = track[i];
    const segmentDist = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
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

export function influenceDistanceWeight(
  metersInCell: number,
  minMetersForFull: number,
): number {
  if (minMetersForFull <= 0) {
    return 1;
  }
  return Math.min(1, metersInCell / minMetersForFull);
}
