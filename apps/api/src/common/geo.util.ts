export function roundCoord(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function isWithinBbox(
  lat: number,
  lng: number,
  north: number,
  south: number,
  east: number,
  west: number,
): boolean {
  return lat <= north && lat >= south && lng <= east && lng >= west;
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

/** Ray-casting point-in-polygon (GeoJSON: coordinates are [lng, lat]). */
export function isPointInPolygon(lat: number, lng: number, polygon: GeoJsonPolygon): boolean {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}
