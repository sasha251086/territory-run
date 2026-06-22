import { readFileSync, existsSync } from 'fs';
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
      'samsunghealth_user_20260621233615/jsons/com.samsung.health.exercise/run-1.location_data.json':
        JSON.stringify(locationJson),
    });

    const result = parser.parseZipBuffer(zipBuffer);
    expect(result.totalSessions).toBe(1);
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].id).toBe('run-1');
  });

  it('parses real Samsung export filename pattern (com.samsung.health.exercise.location_data.json)', () => {
    const workoutId = '641aab23-3128-4af5-9d5b-520b7033d82d';
    const jsonPath =
      `samsunghealth_a.a.nitsenko_20260621233615/jsons/com.samsung.shealth.exercise/6/` +
      `${workoutId}.com.samsung.health.exercise.location_data.json`;

    const zipBuffer = buildZip({
      [jsonPath]: JSON.stringify(locationJson),
    });

    const result = parser.parseZipBuffer(zipBuffer);
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].id).toBe(workoutId);
    expect(result.workouts[0].points.length).toBeGreaterThanOrEqual(2);
  });

  it('resolves CSV blob refs with com.samsung.health.exercise.location_data column', () => {
    const workoutId = '5aa1cd07-baee-4b79-ba53-030d09950950';
    const blobName = `${workoutId}.com.samsung.health.exercise.location_data.json`;
    const jsonPath = `jsons/com.samsung.shealth.exercise/5/${blobName}`;
    const csv =
      'com.samsung.shealth.exercise,6320001,17\n' +
      'live_data_internal,...,com.samsung.health.exercise.location_data,...,com.samsung.health.exercise.exercise_type,...,com.samsung.health.exercise.datauuid\n' +
      `...,${blobName},...,1002,...,${workoutId}\n`;

    const zipBuffer = buildZip({
      'com.samsung.shealth.exercise.20260621233615.csv': csv,
      [jsonPath]: JSON.stringify(locationJson),
    });

    const result = parser.parseZipBuffer(zipBuffer);
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].id).toBe(workoutId);
  });

  it('follows exercise CSV blob references into jsons subfolders', () => {
    const workoutId = '27a44eb3-6fc6-4994-bcd1-eccd80074502';
    const blobPath = `jsons/com.samsung.shealth.exercise/${workoutId[0]}/${workoutId}.json`;
    const csv =
      'meta\n' +
      'com.samsung.shealth.exercise.uuid,com.samsung.shealth.exercise.exercise_type,com.samsung.health.exercise.location_data\n' +
      `${workoutId},1001,${blobPath}\n`;

    const zipBuffer = buildZip({
      'samsunghealth_a.a.nitsenko_20260621233615/com.samsung.shealth.exercise.20260621233615.csv': csv,
      [`samsunghealth_a.a.nitsenko_20260621233615/${blobPath}`]: JSON.stringify(locationJson),
    });

    const result = parser.parseZipBuffer(zipBuffer);
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].id).toBe(workoutId);
    expect(result.workouts[0].points.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects archives without exercise tracks', () => {
    const zipBuffer = buildZip({
      'readme.txt': 'hello',
    });

    expect(() => parser.parseZipBuffer(zipBuffer)).toThrow(SamsungHealthParseError);
  });

  const realZipPath = process.env.SAMSUNG_ZIP_PATH;
  (realZipPath && existsSync(realZipPath) ? it : it.skip)(
    'parses the real Samsung export archive when SAMSUNG_ZIP_PATH is set',
    () => {
      const zipBuffer = readFileSync(realZipPath!);
      const result = parser.parseZipBuffer(zipBuffer, { days: 365 });
      // eslint-disable-next-line no-console
      console.log('Real export parse summary:', {
        total: result.totalSessions,
        withGps: result.withGps,
        importedCandidates: result.workouts.length,
        withoutRoute: result.withoutRoute,
        skippedByDate: result.skippedByDate,
        scanned: result.exerciseFilesScanned,
        hint: result.hint,
      });
      expect(result.totalSessions).toBeGreaterThan(0);
    },
  );
});
