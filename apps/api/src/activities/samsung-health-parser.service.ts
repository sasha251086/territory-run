import { Injectable } from '@nestjs/common';
import { gunzipSync } from 'zlib';
import * as yauzl from 'yauzl';
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

interface ExerciseCsvRow {
  uuid: string;
  exerciseType?: number;
  locationRefs: string[];
}

interface ZipEntryRef {
  path: string;
  entry: yauzl.Entry;
}

interface ParseAccumulator {
  withoutRoute: number;
  totalSessions: number;
  skippedByDate: number;
  withGps: number;
  exerciseFilesScanned: number;
  /** Best GPS point count per workout — used for dedup without retaining all tracks. */
  workoutPointCounts: Map<string, number>;
  importedWorkoutCount: number;
}

@Injectable()
export class SamsungHealthParserService {
  private static readonly EXERCISE_ENTRY_RE =
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.com\.samsung\.health\.exercise)?\.(location_data|live_data)(?:_internal)?(?:\.(?:json|blob|bin|zip))?$/i;

  private static readonly UUID_RE =
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

  private static readonly EXERCISE_PATH_RE =
    /(?:com\.samsung\.(?:shealth\.|health\.)?(?:shealth\.)?exercise|shealth\.exercise)/i;

  async parseZipBuffer(zipBuffer: Buffer, options?: { days?: number }): Promise<SamsungZipParseResult> {
    if (!zipBuffer?.length) {
      throw new SamsungHealthParseError('ZIP archive is empty');
    }

    const zipfile = await this.openZipBuffer(zipBuffer);
    try {
      return await this.parseZipfile(zipfile, options);
    } catch (error) {
      if (error instanceof SamsungHealthParseError) throw error;
      throw new SamsungHealthParseError('File is not a valid ZIP archive');
    } finally {
      zipfile.close();
    }
  }

  async parseZipFile(filePath: string, options?: { days?: number }): Promise<SamsungZipParseResult> {
    const zipfile = await this.openZipFile(filePath);
    try {
      return await this.parseZipfile(zipfile, options);
    } finally {
      zipfile.close();
    }
  }

  async *streamWorkouts(
    filePath: string,
    options?: { days?: number },
  ): AsyncGenerator<SamsungParsedWorkout, SamsungZipParseResult> {
    const zipfile = await this.openZipFile(filePath);
    try {
      const entries = await this.collectEntries(zipfile);
      if (entries.length === 0) {
        throw new SamsungHealthParseError('ZIP archive contains no files');
      }

      const exerciseTypes = await this.loadExerciseTypeMap(zipfile, entries);
      const csvRows = await this.loadExerciseCsvRows(zipfile, entries);
      for (const row of csvRows) {
        if (row.exerciseType != null) {
          exerciseTypes.set(row.uuid, row.exerciseType);
        }
      }

      const acc: ParseAccumulator = {
        withoutRoute: 0,
        totalSessions: Math.max(csvRows.length, 0),
        skippedByDate: 0,
        withGps: 0,
        exerciseFilesScanned: 0,
        workoutPointCounts: new Map(),
        importedWorkoutCount: 0,
      };

      for await (const workout of this.iterLocationWorkouts(
        zipfile,
        entries,
        csvRows,
        exerciseTypes,
        options,
        acc,
      )) {
        yield workout;
      }

      if (acc.importedWorkoutCount === 0 && acc.withGps === 0) {
        throw new SamsungHealthParseError(this.buildEmptyArchiveHint(entries, csvRows.length));
      }

      return this.buildResult(acc, options);
    } finally {
      zipfile.close();
    }
  }

  private async *iterLocationWorkouts(
    zipfile: yauzl.ZipFile,
    entries: ZipEntryRef[],
    csvRows: ExerciseCsvRow[],
    exerciseTypes: Map<string, number>,
    options: { days?: number } | undefined,
    acc: ParseAccumulator,
  ): AsyncGenerator<SamsungParsedWorkout> {
    for (const ref of entries) {
      const workoutId = this.extractLocationWorkoutId(ref.path);
      if (!workoutId) continue;

      acc.exerciseFilesScanned += 1;
      const data = await this.readEntryBuffer(zipfile, ref.entry);
      const workout = this.buildWorkoutFromBuffer(
        workoutId,
        data,
        exerciseTypes.get(workoutId),
        options,
        acc,
      );
      if (workout) yield workout;
    }

    for (const row of csvRows) {
      if (acc.workoutPointCounts.has(row.uuid)) continue;

      for (const refPath of row.locationRefs) {
        const ref = this.resolveEntry(entries, refPath, row.uuid);
        if (!ref) continue;

        acc.exerciseFilesScanned += 1;
        const data = await this.readEntryBuffer(zipfile, ref.entry);
        const type = row.exerciseType ?? exerciseTypes.get(row.uuid);
        const workout = this.buildWorkoutFromBuffer(row.uuid, data, type, options, acc);
        if (workout) {
          yield workout;
          break;
        }
      }
    }
  }

  private buildWorkoutFromBuffer(
    workoutId: string,
    data: Buffer,
    exerciseType: number | undefined,
    options: { days?: number } | undefined,
    acc: ParseAccumulator,
  ): SamsungParsedWorkout | null {
    const samples = this.samplesFromBuffer(data);
    const gpsSamples = samples.filter(
      (sample) => sample.latitude != null && sample.longitude != null,
    );
    if (gpsSamples.length < 2) return null;

    acc.withGps += 1;
    const workout = this.buildWorkout(workoutId, gpsSamples, exerciseType);
    if (!workout) {
      acc.withoutRoute += 1;
      return null;
    }

    if (this.isBeforeCutoff(workout.finishedAt, options?.days)) {
      acc.skippedByDate += 1;
      return null;
    }

    const existingCount = acc.workoutPointCounts.get(workoutId);
    if (existingCount != null && existingCount >= workout.points.length) {
      return null;
    }

    acc.workoutPointCounts.set(workoutId, workout.points.length);
    acc.importedWorkoutCount += 1;
    return workout;
  }

  private async parseZipfile(
    zipfile: yauzl.ZipFile,
    options?: { days?: number },
  ): Promise<SamsungZipParseResult> {
    const acc = await this.processZipEntries(zipfile, options);
    if (acc.importedWorkoutCount === 0 && acc.withGps === 0) {
      throw new SamsungHealthParseError(this.buildEmptyArchiveHint(acc.entries, acc.csvRows.length));
    }
    return this.buildResult(acc, options, acc.workouts);
  }

  private async processZipEntries(
    zipfile: yauzl.ZipFile,
    options?: { days?: number },
  ): Promise<
    ParseAccumulator & { entries: ZipEntryRef[]; csvRows: ExerciseCsvRow[]; workouts: SamsungParsedWorkout[] }
  > {
    const entries = await this.collectEntries(zipfile);
    if (entries.length === 0) {
      throw new SamsungHealthParseError('ZIP archive contains no files');
    }

    const exerciseTypes = await this.loadExerciseTypeMap(zipfile, entries);
    const csvRows = await this.loadExerciseCsvRows(zipfile, entries);
    for (const row of csvRows) {
      if (row.exerciseType != null) {
        exerciseTypes.set(row.uuid, row.exerciseType);
      }
    }

    const acc: ParseAccumulator & {
      entries: ZipEntryRef[];
      csvRows: ExerciseCsvRow[];
      workouts: SamsungParsedWorkout[];
    } = {
      withoutRoute: 0,
      totalSessions: Math.max(csvRows.length, 0),
      skippedByDate: 0,
      withGps: 0,
      exerciseFilesScanned: 0,
      workoutPointCounts: new Map(),
      importedWorkoutCount: 0,
      entries,
      csvRows,
      workouts: [],
    };

    for await (const workout of this.iterLocationWorkouts(
      zipfile,
      entries,
      csvRows,
      exerciseTypes,
      options,
      acc,
    )) {
      acc.workouts.push(workout);
    }

    return acc;
  }

  private buildResult(
    acc: ParseAccumulator,
    options?: { days?: number },
    workouts: SamsungParsedWorkout[] = [],
  ): SamsungZipParseResult {
    const resolvedWorkouts = workouts.length > 0 ? workouts : [];
    const totalSessions = Math.max(acc.totalSessions, acc.importedWorkoutCount);

    let hint: string | undefined;
    if (resolvedWorkouts.length === 0 && acc.withGps > 0 && acc.skippedByDate > 0) {
      hint = `Найдено тренировок с GPS: ${acc.withGps}, но все старше ${options?.days ?? 365} дней.`;
    } else if (resolvedWorkouts.length === 0 && acc.withoutRoute > 0 && acc.withGps === 0) {
      hint =
        'Тренировки в архиве есть, но без GPS-маршрута (дорожка, зал, или Samsung не сохранил координаты).';
    }

    return {
      workouts: resolvedWorkouts,
      withoutRoute: acc.withoutRoute,
      totalSessions,
      skippedByDate: acc.skippedByDate,
      withGps: acc.withGps,
      exerciseFilesScanned: acc.exerciseFilesScanned,
      hint,
    };
  }

  private openZipFile(filePath: string): Promise<yauzl.ZipFile> {
    return new Promise((resolve, reject) => {
      yauzl.open(filePath, { lazyEntries: true, validateEntrySizes: true }, (err, zipfile) => {
        if (err || !zipfile) reject(err ?? new Error('Failed to open ZIP'));
        else resolve(zipfile);
      });
    });
  }

  private openZipBuffer(buffer: Buffer): Promise<yauzl.ZipFile> {
    return new Promise((resolve, reject) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (err, zipfile) => {
        if (err || !zipfile) reject(err ?? new Error('Failed to open ZIP buffer'));
        else resolve(zipfile);
      });
    });
  }

  private collectEntries(zipfile: yauzl.ZipFile): Promise<ZipEntryRef[]> {
    return new Promise((resolve, reject) => {
      const entries: ZipEntryRef[] = [];
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }
        entries.push({ path: this.normalizePath(entry.fileName), entry });
        zipfile.readEntry();
      });
      zipfile.on('end', () => resolve(entries));
      zipfile.on('error', reject);
      zipfile.readEntry();
    });
  }

  private readEntryBuffer(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zipfile.openReadStream(entry, (err, stream) => {
        if (err || !stream) {
          reject(err ?? new Error('Failed to read ZIP entry'));
          return;
        }
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    });
  }

  private async loadExerciseTypeMap(
    zipfile: yauzl.ZipFile,
    entries: ZipEntryRef[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const ref of entries) {
      if (!this.isExerciseCsvPath(ref.path)) continue;
      const text = (await this.readEntryBuffer(zipfile, ref.entry)).toString('utf-8');
      this.mergeExerciseTypesFromCsv(text, map);
    }
    return map;
  }

  private async loadExerciseCsvRows(
    zipfile: yauzl.ZipFile,
    entries: ZipEntryRef[],
  ): Promise<ExerciseCsvRow[]> {
    const rows: ExerciseCsvRow[] = [];
    for (const ref of entries) {
      if (!this.isExerciseCsvPath(ref.path)) continue;
      const text = (await this.readEntryBuffer(zipfile, ref.entry)).toString('utf-8');
      rows.push(...this.parseExerciseCsvText(text));
    }
    return rows;
  }

  private extractLocationWorkoutId(path: string): string | null {
    const namedMatch = path.match(SamsungHealthParserService.EXERCISE_ENTRY_RE);
    if (namedMatch) {
      if (namedMatch[2].toLowerCase() !== 'location_data') return null;
      if (/location_data_internal/i.test(path)) return null;
      return namedMatch[1];
    }

    if (!SamsungHealthParserService.EXERCISE_PATH_RE.test(path)) return null;
    if (/location_data_internal|live_data/i.test(path)) return null;

    const uuidMatch = path.match(SamsungHealthParserService.UUID_RE);
    if (!uuidMatch) return null;
    if (!/location_data/i.test(path)) return null;
    return uuidMatch[1];
  }

  private isBeforeCutoff(finishedAt: Date, days?: number): boolean {
    if (days == null) return false;
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    return finishedAt.getTime() < cutoffMs;
  }

  private isExerciseCsvPath(path: string): boolean {
    return /com\.samsung\.(?:shealth\.|health\.)?exercise.*\.csv$/i.test(path);
  }

  private normalizePath(entryName: string): string {
    return entryName.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  private resolveEntry(
    entries: ZipEntryRef[],
    ref: string,
    uuid: string,
  ): ZipEntryRef | undefined {
    const cleaned = ref.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.?\//, '');
    const candidates = new Set<string>([
      cleaned.toLowerCase(),
      cleaned.replace(/^json\//i, 'jsons/').toLowerCase(),
      cleaned.replace(/^jsons\//i, 'json/').toLowerCase(),
    ]);

    for (const refEntry of entries) {
      const pathLower = refEntry.path.toLowerCase();
      for (const candidate of candidates) {
        if (pathLower === candidate || pathLower.endsWith(`/${candidate}`)) {
          return refEntry;
        }
      }
    }

    const basename = cleaned.split('/').pop()?.toLowerCase();
    if (basename) {
      const matches = entries.filter((refEntry) => {
        const parts = refEntry.path.split('/');
        return parts[parts.length - 1]?.toLowerCase() === basename;
      });
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) {
        const scoped = matches.find((refEntry) =>
          refEntry.path.toLowerCase().includes(uuid.toLowerCase()),
        );
        if (scoped) return scoped;
      }
    }

    const uuidLower = uuid.toLowerCase();
    return entries.find((refEntry) => {
      const pathLower = refEntry.path.toLowerCase();
      return (
        SamsungHealthParserService.EXERCISE_PATH_RE.test(pathLower) &&
        pathLower.includes(uuidLower)
      );
    });
  }

  private buildEmptyArchiveHint(entries: ZipEntryRef[], csvRows: number): string {
    const hasExerciseCsv = entries.some((ref) => this.isExerciseCsvPath(ref.path));
    const hasJsonFolder = entries.some((ref) => /(?:^|\/)jsons?\//i.test(ref.path));

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

  private mergeExerciseTypesFromCsv(text: string, map: Map<string, number>): void {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return;

    const headerIdx = this.findCsvHeaderIndex(lines);
    if (headerIdx < 0) return;

    const headers = this.parseCsvLine(lines[headerIdx]).map((h) => h.trim().toLowerCase());
    const uuidIdx = headers.findIndex(
      (h) => h === 'uuid' || h.endsWith('.datauuid') || h.endsWith('.uuid'),
    );
    const typeIdx = headers.findIndex(
      (h) => h.includes('exercise_type') || h.includes('exercise.type'),
    );
    if (uuidIdx < 0) return;

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

  private parseExerciseCsvText(text: string): ExerciseCsvRow[] {
    const rows: ExerciseCsvRow[] = [];
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return rows;

    const headerIdx = this.findCsvHeaderIndex(lines);
    if (headerIdx < 0) return rows;

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
    if (uuidIdx < 0) return rows;

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

      rows.push({ uuid, exerciseType, locationRefs });
    }

    return rows;
  }

  private samplesFromBuffer(data: Buffer): RawSample[] {
    const parsed = this.decodeJsonEntry(data);
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
