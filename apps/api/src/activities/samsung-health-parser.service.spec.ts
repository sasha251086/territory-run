import AdmZip from 'adm-zip';
import {
  SamsungHealthParserService,
  SamsungHealthParseError,
} from './samsung-health-parser.service';

describe('SamsungHealthParserService', () => {
  let parser: SamsungHealthParserService;

  const locationJson = [
    { start_time: 1718956800000, latitude: 56.9496, longitude: 24.1052 },
    { start_time: 1718956810000, latitude: 56.9498, longitude: 24.1055 },
    { start_time: 1718956820000, latitude: 56.9501, longitude: 24.1059 },
  ];

  beforeEach(() => {
    parser = new SamsungHealthParserService();
  });

  function buildZip(files: Record<string, string | Buffer>): Buffer {
    const zip = new AdmZip();
    for (const [path, content] of Object.entries(files)) {
      const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
      zip.addFile(path, buffer);
    }
    return zip.toBuffer();
  }

  it('parses location_data.json workouts from Samsung export layout', () => {
    const zipBuffer = buildZip({
      'jsons/com.samsung.health.exercise/run-1.location_data.json': JSON.stringify(locationJson),
    });

    const result = parser.parseZipBuffer(zipBuffer);
    expect(result.totalSessions).toBe(1);
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].id).toBe('run-1');
    expect(result.workouts[0].points.length).toBeGreaterThanOrEqual(2);
    expect(result.workouts[0].distanceMeters).toBeGreaterThan(0);
  });

  it('rejects archives without exercise tracks', () => {
    const zipBuffer = buildZip({
      'readme.txt': 'hello',
    });

    expect(() => parser.parseZipBuffer(zipBuffer)).toThrow(SamsungHealthParseError);
  });
});
