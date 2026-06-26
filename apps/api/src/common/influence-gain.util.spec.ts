import {
  capInfluenceGainMultiplier,
  describeInfluenceGain,
  estimateInfluencePerRun,
  locationInfluenceMultiplier,
} from './influence-gain.util';

describe('influence-gain.util', () => {
  it('caps stacked multipliers at MAX_INFLUENCE_GAIN_MULTIPLIER', () => {
    expect(capInfluenceGainMultiplier(2.5)).toBe(1.5);
    expect(capInfluenceGainMultiplier(1.2)).toBe(1.2);
  });

  it('uses home bonus over new-player bonus', () => {
    const mult = locationInfluenceMultiplier(
      {
        homeLat: 56.95,
        homeLng: 24.1,
        createdAt: new Date(),
      },
      { lat: 56.9501, lng: 24.1001 },
      false,
    );
    expect(mult).toBe(1.25);
  });

  it('estimates per-run gain with streak and soft cap', () => {
    const gain = describeInfluenceGain({
      homeLat: 56.95,
      homeLng: 24.1,
      createdAt: new Date('2020-01-01'),
      currentStreak: 14,
      cellsOwned: 80,
      assumeHomeZone: true,
    });
    expect(gain.perRun).toBeGreaterThan(0);
    expect(gain.perRun).toBeLessThanOrEqual(1.5);
    expect(gain.atSoftCap).toBe(true);
  });
});
