import { Injectable } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { gunzipSync } from 'zlib';
import { haversineDistance } from '../common/geo.util';
import type { GpxTrackPoint } from './gpx-parser.service';

export interface SamsungParsedWorkout {
  id: string;
  points: GpxTrackPoint[];
  startedAt: Date;
  finishedAt: Date;
  distanceMeters: number;
  durationSeconds: number;
  exerciseType?: number;
}

export interface SamsungZipParseResult {
  workouts: SamsungParsedWorkout[];
  withoutRoute: number;
  totalSessions: number;
  skippedByDate: number;
  withGps: number;
  exerciseFilesScanned: number;
  hint?: string;
}

export class SamsungHealthParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SamsungHealthParseError';
  }
}

/** Samsung Health predefined exercise types for foot activities (SDK). */
const FOOT_EXERCISE_TYPES = new Set([
  1001, // running
  1002, // walking
  1301, // hiking
  1302, // trail running (variant)
  0, // custom / unknown — keep if GPS present
]);

interface RawSample {
  start_time?: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  speed?: number;
}

type ExerciseFileKind = 'location_data' | 'live_data';

interface ExerciseCsvRow {
  uuid: string;
  exerciseType?: number;
  locationRefs: string[];
  liveRefs: string[];
}

interface EntryIndex {
  byNormalizedPath: Map<string, AdmZip.IZipEntry>;
  byBasename: Map<string, AdmZip.IZipEntry[]>;
}

@Injectable()
export class SamsungHealthParserService {
  private static readonly EXERCISE_ENTRY_RE =
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.com\.samsung\.health\.exercise)?\.(location_data|live_data)(?:_internal)?(?:\.(?:json|blob|bin|zip))?$/i;

  private static readonly UUID_RE =
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

  private static readonly EXERCISE_PATH_RE =
    /(?:com\.samsung\.(?:shealth\.|health\.)?(?:shealth\.)?exercise|shealth\.exercise)/i;

  parseZipBuffer(zipBuffer: Buffer, options?: { days?: number }): SamsungZipParseResult {
    if (!zipBuffer?.length) {
      throw new SamsungHealthParseError('ZIP archive is empty');
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      throw new SamsungHealthParseError('File is not a valid ZIP archive');
    }

    const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
    if (entries.length === 0) {
      throw new SamsungHealthParseError('ZIP archive contains no files');
    }

    const index = this.buildEntryIndex(entries);
    const exerciseTypes = this.parseExerciseTypeMap(entries);
    const csvRows = this.parseExerciseCsvRows(entries);
    for (const row of csvRows) {
      if (row.exerciseType != null) {
        exerciseTypes.set(row.uuid, row.exerciseType);
      }
    }

    const grouped = new Map<string, Partial<Record<ExerciseFileKind, RawSample[]>>>();
    let exerciseFilesScanned = 0;

    for (const entry of entries) {
      const normalized = this.normalizePath(entry.entryName);
      const namedMatch = normalized.match(SamsungHealthParserService.EXERCISE_ENTRY_RE);

      if (namedMatch) {
        const workoutId = namedMatch[1];
        const kind = namedMatch[2].toLowerCase() as ExerciseFileKind;
        const samples = this.samplesFromEntry(entry);
        if (samples.length === 0) continue;

        const gpsSamples = samples.filter(
          (sample) => sample.latitude != null && sample.longitude != null,
        );
        if (kind === 'location_data' && gpsSamples.length < 2) continue;

        exerciseFilesScanned += 1;
        this.mergeGroupedSamples(
          grouped,
          workoutId,
          kind,
          kind === 'location_data' ? gpsSamples : samples,
        );
        continue;
      }

      if (!SamsungHealthParserService.EXERCISE_PATH_RE.test(normalized)) {
        continue;
      }

      const uuidMatch = normalized.match(SamsungHealthParserService.UUID_RE);
      if (!uuidMatch) continue;

      const samples = this.samplesFromEntry(entry);
      exerciseFilesScanned += 1;
      if (samples.length === 0) continue;

      const gpsSamples = samples.filter(
        (sample) => sample.latitude != null && sample.longitude != null,
      );
      if (gpsSamples.length < 2) continue;

      this.mergeGroupedSamples(grouped, uuidMatch[1], 'location_data', gpsSamples);
    }

    for (const row of csvRows) {
      for (const ref of row.locationRefs) {
        const entry = this.resolveEntry(index, ref, row.uuid);
        if (!entry) continue;
        const samples = this.samplesFromEntry(entry);
        exerciseFilesScanned += 1;
        const gpsSamples = samples.filter(
          (sample) => sample.latitude != null && sample.longitude != null,
        );
        if (gpsSamples.length < 2) continue;
        this.mergeGroupedSamples(grouped, row.uuid, 'location_data', gpsSamples);
      }

      for (const ref of row.liveRefs) {
        const entry = this.resolveEntry(index, ref, row.uuid);
        if (!entry) continue;
        const samples = this.samplesFromEntry(entry);
        exerciseFilesScanned += 1;
        if (samples.length === 0) continue;
        this.mergeGroupedSamples(grouped, row.uuid, 'live_data', samples);
      }
    }

    if (grouped.size === 0) {
      throw new SamsungHealthParseError(this.buildEmptyArchiveHint(entries, csvRows.length));
    }

    const cutoffMs =
      options?.days != null
        ? Date.now() - options.days * 24 * 60 * 60 * 1000
        : undefined;

    const workouts: SamsungParsedWorkout[] = [];
    let withoutRoute = 0;
    let skippedByDate = 0;
    let withGps = 0;

    for (const [workoutId, files] of grouped) {
      const locationSamples = files.location_data ?? [];
      if (locationSamples.length === 0) {
        withoutRoute += 1;
        continue;
      }

      withGps += 1;
      const merged = this.mergeTracks([locationSamples, files.live_data ?? []]);
      const workout = this.buildWorkout(workoutId, merged, exerciseTypes.get(workoutId));
      if (!workout) {
        withoutRoute += 1;
        continue;
      }

      if (cutoffMs != null && workout.finishedAt.getTime() < cutoffMs) {
        skippedByDate += 1;
        continue;
      }

      workouts.push(workout);
    }

    let hint: string | undefined;
    if (workouts.length === 0 && withGps > 0 && skippedByDate > 0) {
      hint = `Найдено тренировок с GPS: ${withGps}, но все старше ${options?.days ?? 365} дней.`;
    } else if (workouts.length === 0 && withoutRoute > 0 && withGps === 0) {
      hint =
        'Тренировки в архиве есть, но без GPS-маршрута (дорожка, зал, или Samsung не сохранил координаты).';
    }

    return {
      workouts,
      withoutRoute,
      totalSessions: grouped.size,
      skippedByDate,
      withGps,
      exerciseFilesScanned,
      hint,
    };
  }

  private normalizePath(entryName: string): string {
    return entryName.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  private buildEntryIndex(entries: AdmZip.IZipEntry[]): EntryIndex {
    const byNormalizedPath = new Map<string, AdmZip.IZipEntry>();
    const byBasename = new Map<string, AdmZip.IZipEntry[]>();

    for (const entry of entries) {
      const normalized = this.normalizePath(entry.entryName);
      const variants = new Set<string>([normalized.toLowerCase()]);

      const parts = normalized.split('/');
      if (parts.length > 1) {
        variants.add(parts.slice(1).join('/').toLowerCase());
      }
      if (parts.length > 2) {
        variants.add(parts.slice(2).join('/').toLowerCase());
      }

      for (const key of variants) {
        byNormalizedPath.set(key, entry);
      }

      const basename = parts[parts.length - 1]?.toLowerCase() ?? normalized.toLowerCase();
      const bucket = byBasename.get(basename) ?? [];
      bucket.push(entry);
      byBasename.set(basename, bucket);
    }

    return { byNormalizedPath, byBasename };
  }

  private resolveEntry(
    index: EntryIndex,
    ref: string,
    uuid: string,
  ): AdmZip.IZipEntry | undefined {
    const cleaned = ref.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.?\//, '');
    const candidates = new Set<string>([
      cleaned.toLowerCase(),
      cleaned.replace(/^json\//i, 'jsons/').toLowerCase(),
      cleaned.replace(/^jsons\//i, 'json/').toLowerCase(),
    ]);

    for (const candidate of candidates) {
      const hit = index.byNormalizedPath.get(candidate);
      if (hit) return hit;
    }

    const basename = cleaned.split('/').pop()?.toLowerCase();
    if (basename) {
      const byName = index.byBasename.get(basename);
      if (byName?.length === 1) return byName[0];
      if (byName && byName.length > 1) {
        const scoped = byName.find((entry) =>
          this.normalizePath(entry.entryName).toLowerCase().includes(uuid.toLowerCase()),
        );
        if (scoped) return scoped;
      }
    }

    const uuidLower = uuid.toLowerCase();
    for (const entry of index.byNormalizedPath.values()) {
      const path = this.normalizePath(entry.entryName).toLowerCase();
      if (!SamsungHealthParserService.EXERCISE_PATH_RE.test(path)) continue;
      if (!path.includes(uuidLower)) continue;
      return entry;
    }

    return undefined;
  }

  private mergeGroupedSamples(
    grouped: Map<string, Partial<Record<ExerciseFileKind, RawSample[]>>>,
    workoutId: string,
    kind: ExerciseFileKind,
    samples: RawSample[],
  ) {
    const bucket = grouped.get(workoutId) ?? {};
    bucket[kind] = this.mergeSamples(bucket[kind] ?? [], samples);
    grouped.set(workoutId, bucket);
  }

  private buildEmptyArchiveHint(entries: AdmZip.IZipEntry[], csvRows: number): string {
    const hasExerciseCsv = entries.some(
      (entry) =>
        /com\.samsung\.(?:shealth\.|health\.)?exercise.*\.csv$/i.test(
          this.normalizePath(entry.entryName),
        ),
    );
    const hasJsonFolder = entries.some((entry) =>
      /(?:^|\/)jsons?\//i.test(this.normalizePath(entry.entryName)),
    );

    if (!hasExerciseCsv && !hasJsonFolder) {
      return (
        'Похоже, заархивирована не та папка. Нужен корень экспорта Samsung Health ' +
        '(samsunghealth_.../), где лежат CSV и папка jsons/.'
      );
    }

    if (csvRows > 0) {
      return (
        `В CSV найдено тренировок: ${csvRows}, но GPS-blob файлы не удалось прочитать. ` +
        'Проверьте, что в ZIP есть папка jsons/com.samsung.shealth.exercise/.'
      );
    }

    return (
      'В архиве не найдены GPS-треки. Ожидаются файлы jsons/.../exercise/.../uuid.json ' +
      'или *.location_data.json внутри экспорта samsunghealth_.../'
    );
  }

  private parseExerciseCsvRows(entries: AdmZip.IZipEntry[]): ExerciseCsvRow[] {
    const rows: ExerciseCsvRow[] = [];

    for (const entry of entries) {
      const name = this.normalizePath(entry.entryName);
      if (!/com\.samsung\.(?:shealth\.|health\.)?exercise.*\.csv$/i.test(name)) continue;

      const text = entry.getData().toString('utf-8').replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) continue;

      const headerIdx = this.findCsvHeaderIndex(lines);
      if (headerIdx < 0) continue;

      const headers = this.parseCsvLine(lines[headerIdx]).map((h) => h.trim());
      const uuidIdx = headers.findIndex((h) => {
        const lower = h.toLowerCase();
        return (
          lower === 'uuid' ||
          lower.endsWith('.datauuid') ||
          lower.endsWith('.uuid') ||
          lower === 'com.samsung.health.exercise.datauuid'
        );
      });
      if (uuidIdx < 0) continue;

      const typeIdx = headers.findIndex((h) => {
        const lower = h.toLowerCase();
        return lower.includes('exercise_type') || lower.includes('exercise.type');
      });

      const locationCols = headers
        .map((header, idx) => ({ header, idx }))
        .filter(({ header }) => {
          const lower = header.toLowerCase();
          return (
            lower === 'com.samsung.health.exercise.location_data' ||
            (lower.includes('location_data') && !lower.includes('_internal'))
          );
        });
      const liveCols = headers
        .map((header, idx) => ({ header, idx }))
        .filter(({ header }) => {
          const lower = header.toLowerCase();
          return (
            lower === 'com.samsung.health.exercise.live_data' ||
            (lower.includes('live_data') && !lower.includes('_internal'))
          );
        });

      for (const line of lines.slice(headerIdx + 1)) {
        const cols = this.parseCsvLine(line);
        const uuid = cols[uuidIdx]?.replace(/"/g, '').trim();
        if (!uuid || !SamsungHealthParserService.UUID_RE.test(uuid)) continue;

        let exerciseType: number | undefined;
        if (typeIdx >= 0) {
          const parsed = Number(cols[typeIdx]?.replace(/"/g, '').trim());
          if (!Number.isNaN(parsed)) exerciseType = parsed;
        }

        const locationRefs = locationCols
          .map(({ idx }) => cols[idx]?.replace(/"/g, '').trim())
          .filter((value) => value && value.length > 0);
        const liveRefs = liveCols
          .map(({ idx }) => cols[idx]?.replace(/"/g, '').trim())
          .filter((value) => value && value.length > 0);

        rows.push({ uuid, exerciseType, locationRefs, liveRefs });
      }
    }

    return rows;
  }

  private samplesFromEntry(entry: AdmZip.IZipEntry): RawSample[] {
    const parsed = this.decodeJsonEntry(entry.getData());
    if (!parsed) return [];
    return this.normalizeSamples(parsed);
  }

  private decodeJsonEntry(data: Buffer): unknown | null {
    if (!data.length) return null;

    const attempts: Buffer[] = [data];
    try {
      attempts.push(gunzipSync(data));
    } catch {
      // not gzip
    }

    for (const buffer of attempts) {
      try {
        return JSON.parse(buffer.toString('utf-8'));
      } catch {
        // try next
      }
    }

    return null;
  }

  private normalizeSamples(parsed: unknown): RawSample[] {
    const rows = this.flattenJsonRows(parsed);
    const samples: RawSample[] = [];

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const record = row as Record<string, unknown>;
      const start_time = this.readStartTimeMs(record);
      const latitude = this.readNumber(record.latitude ?? record.lat);
      const longitude = this.readNumber(record.longitude ?? record.lng ?? record.lon);
      if (start_time == null) continue;

      samples.push({
        start_time,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        altitude: this.readNumber(record.altitude ?? record.alt) ?? undefined,
        speed: this.readNumber(record.speed) ?? undefined,
      });
    }

    return samples.sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0));
  }

  private flattenJsonRows(parsed: unknown): unknown[] {
    if (parsed == null) return [];
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item) => this.flattenJsonRows(item));
    }
    if (typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const nested =
        record.data ??
        record.samples ??
        record.locations ??
        record.segments ??
        record.route ??
        record.location_data ??
        record.live_data;
      if (nested != null) {
        return this.flattenJsonRows(nested);
      }
      return [parsed];
    }
    return [];
  }

  private readStartTimeMs(record: Record<string, unknown>): number | null {
    const raw =
      record.start_time ??
      record.startTime ??
      record.timestamp ??
      record.time;

    if (typeof raw === 'string') {
      const parsed = Date.parse(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const numeric = this.readNumber(raw);
    if (numeric == null) return null;
    if (numeric < 1_000_000_000_000) {
      return numeric * 1000;
    }
    return numeric;
  }

  private mergeSamples(existing: RawSample[], incoming: RawSample[]): RawSample[] {
    const byTime = new Map<number, RawSample>();
    for (const sample of [...existing, ...incoming]) {
      if (sample.start_time == null) continue;
      const prev = byTime.get(sample.start_time) ?? {};
      byTime.set(sample.start_time, { ...prev, ...sample });
    }
    return [...byTime.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, sample]) => sample);
  }

  private mergeTracks(tracks: RawSample[][]): RawSample[] {
    return this.mergeSamples([], tracks.flat());
  }

  private buildWorkout(
    workoutId: string,
    samples: RawSample[],
    exerciseType?: number,
  ): SamsungParsedWorkout | null {
    if (exerciseType != null && !FOOT_EXERCISE_TYPES.has(exerciseType)) {
      return null;
    }

    const points: GpxTrackPoint[] = [];
    for (const sample of samples) {
      if (sample.latitude == null || sample.longitude == null || sample.start_time == null) continue;
      points.push({
        lat: sample.latitude,
        lng: sample.longitude,
        timestamp: new Date(sample.start_time).toISOString(),
      });
    }

    if (points.length < 2) return null;

    const startedAt = new Date(points[0].timestamp);
    const finishedAt = new Date(points[points.length - 1].timestamp);
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime())) return null;

    let distanceMeters = 0;
    for (let i = 1; i < points.length; i += 1) {
      distanceMeters += haversineDistance(
        points[i - 1].lat,
        points[i - 1].lng,
        points[i].lat,
        points[i].lng,
      );
    }

    const durationSeconds = Math.max(
      1,
      Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
    );

    return {
      id: workoutId,
      points,
      startedAt,
      finishedAt,
      distanceMeters: Math.round(distanceMeters),
      durationSeconds,
      exerciseType,
    };
  }

  private parseExerciseTypeMap(entries: AdmZip.IZipEntry[]): Map<string, number> {
    const map = new Map<string, number>();

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = this.normalizePath(entry.entryName);
      if (!/com\.samsung\.(?:shealth\.|health\.)?exercise.*\.csv$/i.test(name)) continue;

      const text = entry.getData().toString('utf-8').replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) continue;

      const headerIdx = this.findCsvHeaderIndex(lines);
      if (headerIdx < 0) continue;

      const headers = this.parseCsvLine(lines[headerIdx]).map((h) => h.trim().toLowerCase());
      const uuidIdx = headers.findIndex(
        (h) => h === 'uuid' || h.endsWith('.datauuid') || h.endsWith('.uuid'),
      );
      const typeIdx = headers.findIndex(
        (h) => h.includes('exercise_type') || h.includes('exercise.type'),
      );
      if (uuidIdx < 0) continue;

      for (const line of lines.slice(headerIdx + 1)) {
        const cols = this.parseCsvLine(line);
        const uuid = cols[uuidIdx]?.replace(/"/g, '').trim();
        if (!uuid) continue;
        if (typeIdx >= 0) {
          const type = Number(cols[typeIdx]?.replace(/"/g, '').trim());
          if (!Number.isNaN(type)) map.set(uuid, type);
        }
      }
    }

    return map;
  }

  private findCsvHeaderIndex(lines: string[]): number {
    return lines.findIndex((line) => {
      const lower = line.toLowerCase();
      return (
        lower.includes('datauuid') ||
        lower.includes('exercise_type') ||
        lower.includes('exercise.type') ||
        (lower.includes('uuid') && lower.includes('exercise'))
      );
    });
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    result.push(current);
    return result;
  }

  private readNumber(value: unknown): number | null {
    if (value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
