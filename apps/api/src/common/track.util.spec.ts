import { sanitizeTrackPoints } from './track.util';

describe('sanitizeTrackPoints', () => {
  it('removes duplicate timestamps', () => {
    const result = sanitizeTrackPoints([
      { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T10:00:00.000Z' },
      { lat: 56.951, lng: 24.101, timestamp: '2026-06-21T10:00:00.000Z' },
      { lat: 56.9504, lng: 24.1004, timestamp: '2026-06-21T10:00:10.000Z' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[1].lat).toBe(56.9504);
  });

  it('drops GPS spike points with impossible speed', () => {
    const result = sanitizeTrackPoints([
      { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T10:00:00.000Z' },
      { lat: 56.96, lng: 24.11, timestamp: '2026-06-21T10:00:05.000Z' },
      { lat: 56.9504, lng: 24.1004, timestamp: '2026-06-21T10:00:15.000Z' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[1].lat).toBe(56.9504);
  });

  it('keeps sub-second samples for track shape (speed check uses anticheat skip)', () => {
    const result = sanitizeTrackPoints([
      { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T10:00:00.000Z' },
      { lat: 56.9501, lng: 24.1001, timestamp: '2026-06-21T10:00:00.500Z' },
      { lat: 56.951, lng: 24.101, timestamp: '2026-06-21T10:00:40.000Z' },
    ]);

    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});
