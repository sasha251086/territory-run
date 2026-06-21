import { GpxParserService, GpxParseError } from './gpx-parser.service';

describe('GpxParserService', () => {
  let service: GpxParserService;

  beforeEach(() => {
    service = new GpxParserService();
  });

  const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="56.9496" lon="24.1052">
        <time>2026-06-21T08:00:01Z</time>
      </trkpt>
      <trkpt lat="56.9498" lon="24.1055">
        <time>2026-06-21T08:00:06Z</time>
      </trkpt>
      <trkpt lat="56.9501" lon="24.1059">
        <time>2026-06-21T08:00:11Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

  it('should parse valid GPX with timestamps', () => {
    const result = service.parseGpx(sampleGpx);

    expect(result.points).toHaveLength(3);
    expect(result.points[0]).toEqual({
      lat: 56.9496,
      lng: 24.1052,
      timestamp: '2026-06-21T08:00:01Z',
    });
    expect(result.durationSeconds).toBe(10);
    expect(result.distanceMeters).toBeGreaterThan(0);
  });

  it('should reject GPX without timestamps', () => {
    const gpxWithoutTime = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="56.9496" lon="24.1052"></trkpt>
      <trkpt lat="56.9498" lon="24.1055"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

    expect(() => service.parseGpx(gpxWithoutTime)).toThrow(GpxParseError);
    expect(() => service.parseGpx(gpxWithoutTime)).toThrow(/timestamps/i);
  });

  it('should reject empty GPX track', () => {
    const emptyGpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1"></gpx>`;
    expect(() => service.parseGpx(emptyGpx)).toThrow(/GPS track points/i);
  });

  it('should reject invalid XML', () => {
    expect(() => service.parseGpx('not xml at all')).toThrow(GpxParseError);
  });
});
