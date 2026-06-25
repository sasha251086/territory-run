import {
  distanceMetersByH3Cell,
  influenceDistanceWeight,
} from './track-distance.util';

describe('track-distance.util', () => {
  it('accumulates segment distance inside one cell', () => {
    const map = distanceMetersByH3Cell([
      { lat: 56.95, lng: 24.1 },
      { lat: 56.951, lng: 24.1 },
    ]);
    const total = [...map.values()].reduce((sum, value) => sum + value, 0);
    expect(total).toBeGreaterThan(100);
  });

  it('scales influence by distance in cell', () => {
    expect(influenceDistanceWeight(25, 50)).toBe(0.5);
    expect(influenceDistanceWeight(50, 50)).toBe(1);
    expect(influenceDistanceWeight(80, 50)).toBe(1);
  });
});
