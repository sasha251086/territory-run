export type LatLngPair = [number, number];

export function hexCentroid(boundary: LatLngPair[]): LatLngPair {
  let lat = 0;
  let lng = 0;
  for (const [a, b] of boundary) {
    lat += a;
    lng += b;
  }
  return [lat / boundary.length, lng / boundary.length];
}

/**
 * Split H3 hex into two equal halves through the center — no gaps.
 * Each half covers 3 of 6 center triangles: (v0,v1,v2,v3) and (v3,v4,v5,v0).
 */
export function splitHexDiagonal(boundary: LatLngPair[]): {
  halfA: LatLngPair[];
  halfB: LatLngPair[];
} {
  if (boundary.length < 6) {
    return { halfA: boundary, halfB: [] };
  }

  const center = hexCentroid(boundary);
  const [v0, v1, v2, v3, v4, v5] = boundary;

  return {
    halfA: [center, v0, v1, v2, v3],
    halfB: [center, v3, v4, v5, v0],
  };
}

export function splitHexHalves(boundary: LatLngPair[]): { mine: LatLngPair[]; rival: LatLngPair[] } {
  const { halfA, halfB } = splitHexDiagonal(boundary);
  return { mine: halfA, rival: halfB };
}
