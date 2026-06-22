import { Capacitor } from '@capacitor/core';
import { Health } from 'capacitor-health';
import type { Workout, RouteSample } from 'capacitor-health';
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

// mley/capacitor-health отдаёт GPS-маршрут тренировки через queryWorkouts({ includeRoute: true }).
// На iOS это HKWorkoutRoute, на Android — ExerciseRoute из Health Connect.
// Права: READ_WORKOUTS (сводка), READ_ROUTE (маршрут), READ_DISTANCE (дистанция).
const READ_PERMISSIONS = ['READ_WORKOUTS', 'READ_ROUTE', 'READ_DISTANCE'] as const;

// Тренировки, дающие осмысленный пеший маршрут для захвата клеток.
const FOOT_ACTIVITY_PATTERN = /run|walk|hik|jog|trail|treadmill|бег|ходьб/i;

// ВАЖНО: TypeScript-типы плагина объявляют permissions как массив, но нативный код
// (Android) реально возвращает объект вида { READ_WORKOUTS: true, ... }. Поддерживаем оба.
function isPermissionGranted(permissions: unknown, key: string): boolean {
  if (Array.isArray(permissions)) {
    return permissions.some(
      (entry) => entry && typeof entry === 'object' && (entry as Record<string, boolean>)[key] === true,
    );
  }
  if (permissions && typeof permissions === 'object') {
    return (permissions as Record<string, boolean>)[key] === true;
  }
  return false;
}

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
      const result = await Health.isHealthAvailable();
      return result.available;
    } catch {
      return false;
    }
  },

  async requestPermissions(): Promise<boolean> {
    if (!this.isNativeApp()) return false;
    try {
      const status = await Health.requestHealthPermissions({
        permissions: [...READ_PERMISSIONS],
      });
      return isPermissionGranted(status.permissions, 'READ_WORKOUTS');
    } catch (error) {
      console.error('Health permissions denied', error);
      return false;
    }
  },

  async getRecentWorkouts(days = 14): Promise<Workout[]> {
    if (!this.isNativeApp()) return [];

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await Health.queryWorkouts({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      includeRoute: true,
      includeHeartRate: false,
      includeSteps: false,
    });

    const workouts = result.workouts ?? [];
    // Импортируем только тренировки, у которых есть GPS-маршрут (>= 2 точки).
    // Тип фильтруем мягко: явный пеший тип ИЛИ неизвестный тип, но с маршрутом.
    return workouts.filter((w) => {
      const hasRoute = Array.isArray(w.route) && w.route.length >= 2;
      if (!hasRoute) return false;
      if (!w.workoutType) return true;
      return FOOT_ACTIVITY_PATTERN.test(w.workoutType);
    });
  },

  extractRoute(workout: Workout): TrackPoint[] {
    const route: RouteSample[] = Array.isArray(workout.route) ? workout.route : [];

    return route
      .map((point) => {
        if (point.lat == null || point.lng == null || !point.timestamp) return null;
        return {
          lat: point.lat,
          lng: point.lng,
          timestamp: new Date(point.timestamp).toISOString(),
        } satisfies TrackPoint;
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

      const platformId = workout.id || `${workout.startDate}-${workout.endDate}`;
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
            distanceMeters: Math.round(workout.distance ?? 0),
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
