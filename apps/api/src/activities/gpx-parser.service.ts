import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { haversineDistance } from '../common/geo.util';

export interface GpxTrackPoint {
  lat: number;
  lng: number;
  timestamp: string;
}

export interface ParsedGpxTrack {
  points: GpxTrackPoint[];
  startedAt: Date;
  finishedAt: Date;
  distanceMeters: number;
  durationSeconds: number;
}

export class GpxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GpxParseError';
  }
}

@Injectable()
export class GpxParserService {
  parseGpx(fileContent: string): ParsedGpxTrack {
    if (!fileContent.trim()) {
      throw new GpxParseError('GPX file is empty');
    }

    let parsed: unknown;
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });
      parsed = parser.parse(fileContent);
    } catch {
      throw new GpxParseError('GPX file is damaged or is not valid XML');
    }

    const rawPoints = this.collectTrackPoints(parsed);
    if (rawPoints.length === 0) {
      throw new GpxParseError('GPX file does not contain GPS track points');
    }

    if (rawPoints.length < 2) {
      throw new GpxParseError('GPX track must contain at least 2 points');
    }

    const points: GpxTrackPoint[] = [];
    for (const rawPoint of rawPoints) {
      const raw = rawPoint as Record<string, unknown>;
      const lat = this.readCoordinate(raw, '@_lat', 'lat');
      const lng = this.readCoordinate(raw, '@_lon', 'lon', 'lng');
      const timestamp = this.readTimestamp(raw);

      if (!timestamp) {
        throw new GpxParseError(
          'GPX track points are missing timestamps — export a file with time data',
        );
      }

      points.push({ lat, lng, timestamp });
    }

    const startedAt = new Date(points[0].timestamp);
    const finishedAt = new Date(points[points.length - 1].timestamp);

    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime())) {
      throw new GpxParseError('GPX contains invalid timestamps');
    }

    let distanceMeters = 0;
    for (let index = 1; index < points.length; index += 1) {
      distanceMeters += haversineDistance(
        points[index - 1].lat,
        points[index - 1].lng,
        points[index].lat,
        points[index].lng,
      );
    }

    const durationSeconds = Math.max(
      1,
      Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
    );

    return {
      points,
      startedAt,
      finishedAt,
      distanceMeters: Math.round(distanceMeters),
      durationSeconds,
    };
  }

  private collectTrackPoints(node: unknown, output: unknown[] = []): unknown[] {
    if (!node || typeof node !== 'object') {
      return output;
    }

    const record = node as Record<string, unknown>;

    if ('trkpt' in record) {
      const trackPoints = Array.isArray(record.trkpt) ? record.trkpt : [record.trkpt];
      output.push(...trackPoints.filter(Boolean));
    }

    if ('rtept' in record) {
      const routePoints = Array.isArray(record.rtept) ? record.rtept : [record.rtept];
      output.push(...routePoints.filter(Boolean));
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        this.collectTrackPoints(value, output);
      }
    }

    return output;
  }

  private readCoordinate(
    point: Record<string, unknown>,
    ...keys: string[]
  ): number {
    for (const key of keys) {
      const value = point[key];
      if (value == null) {
        continue;
      }
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    throw new GpxParseError('GPX track point is missing coordinates');
  }

  private readTimestamp(point: Record<string, unknown>): string | null {
    const time = point.time;
    if (typeof time === 'string' && time.trim()) {
      return time;
    }
    if (typeof time === 'number') {
      return new Date(time).toISOString();
    }
    return null;
  }
}
