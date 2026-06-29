export type RoutePoint = { lat: number; lng: number };

/** Normalize GPS track points stored as JSON (lat/lng or latitude/longitude). */
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

/** Downsample route for API payloads while keeping shape. */
export function downsampleRoutePoints(route: RoutePoint[], maxPoints = 800): RoutePoint[] {
  if (route.length <= maxPoints) {
    return route;
  }
  const step = (route.length - 1) / (maxPoints - 1);
  const sampled: RoutePoint[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    sampled.push(route[Math.round(i * step)]);
  }
  return sampled;
}
