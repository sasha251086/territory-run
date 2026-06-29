import { normalizeRoutePoints } from './route-points.util';
import { distanceMetersByH3Cell } from './track-distance.util';

describe('normalizeRoutePoints', () => {
  it('accepts lat/lng and latitude/longitude', () => {
    expect(
      normalizeRoutePoints([
        { lat: 56.95, lng: 24.1 },
        { latitude: 56.96, longitude: 24.11 },
      ]),
    ).toEqual([
      { lat: 56.95, lng: 24.1 },
      { lat: 56.96, lng: 24.11 },
    ]);
  });
});

describe('distanceMetersByH3Cell', () => {
  it('maps a short segment to h3 cells', () => {
    const map = distanceMetersByH3Cell([
      { lat: 56.9496, lng: 24.1052 },
      { lat: 56.9504, lng: 24.1062 },
    ]);
    expect(map.size).toBeGreaterThan(0);
  });
});
