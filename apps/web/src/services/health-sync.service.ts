import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import type { Workout } from '@capgo/capacitor-health';
import { apiRequest } from '../api/client';

export interface HealthSyncResult {
  imported: number;
  duplicates: number;
  withoutRoute: number;
  total: number;
}

interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: string;
}

/**
 * ВНИМАНИЕ (блокер маршрута):
 * Плагин @capgo/capacitor-health (v8.x) в типе Workout НЕ возвращает GPS-трек
 * тренировки — только сводку (тип, длительность, дистанция, источник, platformId).
 * Territory Run для захвата клеток нужен именно массив точек маршрута.
 *
 * Поэтому ниже мы защитно пытаемся прочитать поле `route`, если конкретная
 * сборка/форк плагина его предоставляет. Если маршрута нет — тренировка
 * пропускается (withoutRoute), а не отправляется на сервер без трека.
 *
 * Чтобы фича реально импортировала пробежки, нужно подключить источник
 * маршрута (route-capable плагин или небольшой кастомный нативный плагин,
 * читающий HKWorkoutRoute на iOS и ExerciseRoute в Health Connect на Android).
 */
interface NativeRoutePoint {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  timestamp?: string;
  time?: string;
  date?: string;
}

type WorkoutWithRoute = Workout & { route?: NativeRoutePoint[] };

const RUN_LIKE_TYPES = new Set(['running', 'walking', 'hiking']);

export const healthSync = {
  isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  },

  source(): 'apple_health' | 'health_connect' {
    return Capacitor.getPlatform() === 'ios' ? 'apple_health' : 'health_connect';
  },

  async isAvailable(): Promise<boolean> {
    if (!this.isNativeApp()) return false;
    try {
      const result = await Health.isAvailable();
      return result.available;
    } catch {
      return false;
    }
  },

  async requestPermissions(): Promise<boolean> {
    if (!this.isNativeApp()) return false;
    try {
      const status = await Health.requestAuthorization({
        read: ['workouts', 'distance'],
      });
      return status.readAuthorized.includes('workouts');
    } catch (error) {
      console.error('Health permissions denied', error);
      return false;
    }
  },

  async getRecentWorkouts(days = 14): Promise<WorkoutWithRoute[]> {
    if (!this.isNativeApp()) return [];

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const collected: WorkoutWithRoute[] = [];
    let anchor: string | undefined;

    do {
      const result = await Health.queryWorkouts({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 50,
        ascending: true,
        anchor,
      });
      collected.push(...(result.workouts as WorkoutWithRoute[]));
      anchor = result.anchor;
    } while (anchor);

    return collected.filter((w) => RUN_LIKE_TYPES.has(w.workoutType));
  },

  extractRoute(workout: WorkoutWithRoute): TrackPoint[] {
    if (!Array.isArray(workout.route)) return [];

    return workout.route
      .map((point) => {
        const lat = point.latitude ?? point.lat;
        const lng = point.longitude ?? point.lng;
        const timestamp = point.timestamp ?? point.time ?? point.date;
        if (lat == null || lng == null || !timestamp) return null;
        return { lat, lng, timestamp } satisfies TrackPoint;
      })
      .filter((p): p is TrackPoint => p !== null);
  },

  async syncRecent(days = 14): Promise<HealthSyncResult> {
    const result: HealthSyncResult = {
      imported: 0,
      duplicates: 0,
      withoutRoute: 0,
      total: 0,
    };

    if (!this.isNativeApp()) return result;

    const workouts = await this.getRecentWorkouts(days);
    result.total = workouts.length;
    const source = this.source();

    for (const workout of workouts) {
      const track = this.extractRoute(workout);
      if (track.length < 2) {
        result.withoutRoute += 1;
        continue;
      }

      const platformId = workout.platformId || `${workout.startDate}-${workout.endDate}`;
      const durationSeconds =
        workout.duration ||
        Math.round(
          (new Date(workout.endDate).getTime() - new Date(workout.startDate).getTime()) / 1000,
        );

      try {
        await apiRequest('/activities/import-native', {
          method: 'POST',
          body: JSON.stringify({
            source,
            platformId,
            distanceMeters: Math.round(workout.totalDistance ?? 0),
            durationSeconds,
            startedAt: new Date(workout.startDate).toISOString(),
            finishedAt: new Date(workout.endDate).toISOString(),
            track,
          }),
        });
        result.imported += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/already imported|duplicate/i.test(message)) {
          result.duplicates += 1;
        } else {
          throw error;
        }
      }
    }

    return result;
  },
};
