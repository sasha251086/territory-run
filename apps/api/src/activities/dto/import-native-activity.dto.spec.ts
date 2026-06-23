import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ImportNativeActivityDto } from './import-native-activity.dto';

function dto(overrides: Partial<ImportNativeActivityDto> = {}) {
  return plainToInstance(ImportNativeActivityDto, {
    source: 'samsung_health',
    platformId: 'samsung_1710000000000',
    distanceMeters: 5000,
    durationSeconds: 1800,
    startedAt: '2026-06-21T10:00:00.000Z',
    finishedAt: '2026-06-21T10:30:00.000Z',
    track: [
      { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T10:00:00.000Z' },
      { lat: 56.96, lng: 24.11, timestamp: '2026-06-21T10:05:00.000Z' },
    ],
    ...overrides,
  });
}

describe('ImportNativeActivityDto', () => {
  it('accepts samsung_health as source', async () => {
    const errors = await validate(dto());
    expect(errors).toHaveLength(0);
  });

  it('accepts health_connect and apple_health', async () => {
    for (const source of ['health_connect', 'apple_health'] as const) {
      const errors = await validate(dto({ source }));
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects unknown source', async () => {
    const errors = await validate(dto({ source: 'strava' as never }));
    expect(errors.some((e) => e.property === 'source')).toBe(true);
  });
});
