import { AnticheatService } from './anticheat.service';

describe('AnticheatService', () => {
  let service: AnticheatService;

  beforeEach(() => {
    service = new AnticheatService();
  });

  it('should accept a normal running track (~10 km/h)', () => {
    const result = service.validateTrack([
      { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T10:00:00.000Z' },
      { lat: 56.951, lng: 24.101, timestamp: '2026-06-21T10:00:40.000Z' },
    ]);

    expect(result).toEqual({ valid: true });
  });

  it('should ignore sub-second GPS batches when checking speed', () => {
    const result = service.validateTrack([
      { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T10:00:00.000Z' },
      { lat: 56.96, lng: 24.11, timestamp: '2026-06-21T10:00:00.200Z' },
      { lat: 56.961, lng: 24.111, timestamp: '2026-06-21T10:00:40.000Z' },
    ]);

    expect(result).toEqual({ valid: true });
  });

  it('should reject a segment faster than 40 km/h', () => {
    const result = service.validateTrack([
      { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T10:00:00.000Z' },
      { lat: 56.96, lng: 24.11, timestamp: '2026-06-21T10:00:05.000Z' },
    ]);

    expect(result).toEqual({ valid: false, reason: 'SPEED_EXCEEDED' });
  });

  it('should reject out-of-order timestamps as GPS anomaly', () => {
    const result = service.validateTrack([
      { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T10:00:10.000Z' },
      { lat: 56.951, lng: 24.101, timestamp: '2026-06-21T10:00:00.000Z' },
    ]);

    expect(result).toEqual({ valid: false, reason: 'GPS_ANOMALY' });
  });

  it('should reject a single-point track', () => {
    const result = service.validateTrack([
      { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T10:00:00.000Z' },
    ]);

    expect(result).toEqual({ valid: false, reason: 'INSUFFICIENT_POINTS' });
  });
});
