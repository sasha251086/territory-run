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

@Injectable()
export class SamsungHealthParserService {
  private static readonly EXERCISE_ENTRY_RE =
    /([^/\\]+)\.(location_data|live_data)(?:\.(?:json|blob|bin|zip))?$/i;

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

    const entries = zip.getEntries();
    if (entries.length === 0) {
      throw new SamsungHealthParseError('ZIP archive contains no files');
    }

    const exerciseTypes = this.parseExerciseTypeMap(entries);
    const grouped = new Map<string, Partial<Record<ExerciseFileKind, RawSample[]>>>();

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const normalized = entry.entryName.replace(/\\/g, '/');
      if (!normalized.includes('com.samsung.health.exercise') && !normalized.includes('shealth.exercise')) {
        // Still try generic location_data filenames anywhere in the archive.
        if (!SamsungHealthParserService.EXERCISE_ENTRY_RE.test(normalized)) continue;
      }

      const match = normalized.match(SamsungHealthParserService.EXERCISE_ENTRY_RE);
      if (!match) continue;

      const workoutId = match[1];
      const kind = match[2].toLowerCase() as ExerciseFileKind;
      const parsed = this.decodeJsonEntry(entry.getData());
      if (!parsed) continue;

      const samples = this.normalizeSamples(parsed);
      if (samples.length === 0) continue;

      const bucket = grouped.get(workoutId) ?? {};
      bucket[kind] = this.mergeSamples(bucket[kind] ?? [], samples);
      grouped.set(workoutId, bucket);
    }

    if (grouped.size === 0) {
      throw new SamsungHealthParseError(
        'No Samsung Health workout tracks found. Expected files like jsons/com.samsung.health.exercise/{id}.location_data.json inside the ZIP.',
      );
    }

    const cutoffMs =
      options?.days != null
        ? Date.now() - options.days * 24 * 60 * 60 * 1000
        : undefined;

    const workouts: SamsungParsedWorkout[] = [];
    let withoutRoute = 0;

    for (const [workoutId, files] of grouped) {
      const locationSamples = files.location_data ?? [];
      if (locationSamples.length === 0) {
        withoutRoute += 1;
        continue;
      }

      const merged = this.mergeTracks([locationSamples, files.live_data ?? []]);
      const workout = this.buildWorkout(workoutId, merged, exerciseTypes.get(workoutId));
      if (!workout) {
        withoutRoute += 1;
        continue;
      }

      if (cutoffMs != null && workout.finishedAt.getTime() < cutoffMs) {
        continue;
      }

      workouts.push(workout);
    }

    return {
      workouts,
      withoutRoute,
      totalSessions: grouped.size,
    };
  }

  private decodeJsonEntry(data: Buffer): unknown | null {
    if (!data.length) return null;

    const attempts: Buffer[] = [data];
    if (data[0] === 0x1f && data[1] === 0x8b) {
      try {
        attempts.push(gunzipSync(data));
      } catch {
        // fall through
      }
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
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const samples: RawSample[] = [];

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const record = row as Record<string, unknown>;
      const start_time = this.readNumber(record.start_time);
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
      const name = entry.entryName.replace(/\\/g, '/');
      if (!/com\.samsung\.(shealth\.)?health\.exercise.*\.csv$/i.test(name)) continue;

      const text = entry.getData().toString('utf-8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) continue;

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const uuidIdx = headers.findIndex((h) => h === 'uuid' || h === 'datauuid' || h.endsWith('.uuid'));
      const typeIdx = headers.findIndex(
        (h) => h === 'exercise_type' || h === 'exercise type' || h.endsWith('.exercise_type'),
      );
      if (uuidIdx < 0) continue;

      for (const line of lines.slice(1)) {
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
