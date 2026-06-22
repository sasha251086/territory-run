import { Capacitor } from '@capacitor/core';
import { Health } from 'capacitor-health';
import type { Workout, RouteSample } from 'capacitor-health';
import { apiRequest } from '../api/client';
import { ExerciseRoute } from '../plugins/exercise-route';
import type { ExerciseSession, RoutePoint } from '../plugins/exercise-route';

export interface HealthSyncResult {
  imported: number;
  duplicates: number;
  withoutRoute: number;
  total: number;
  routeAttempts: number;
  pluginAvailable: boolean;
  noDataInHealthConnect: number;
  userDenied: number;
}

export interface ConsentSyncPreview {
  total: number;
  withRoute: number;
  pendingConsent: number;
  alreadyImported: number;
}

export interface SyncProgress {
  current: number;
  total: number;
  recordId: string;
}

interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: string;
}

const READ_PERMISSIONS = ['READ_WORKOUTS', 'READ_ROUTE', 'READ_DISTANCE'] as const;
const IMPORTED_IDS_KEY = 'territory_run_health_imported_ids';

// Samsung часто пишет тип 0 (OTHER) вместо RUNNING — включаем его.
const FOOT_EXERCISE_TYPES = new Set([0, 37, 52, 56, 57, 79]);

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

function getImportedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(IMPORTED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

function markImported(recordId: string) {
  const ids = getImportedIds();
  ids.add(recordId);
  localStorage.setItem(IMPORTED_IDS_KEY, JSON.stringify([...ids]));
}

function isFootSession(session: ExerciseSession): boolean {
  return FOOT_EXERCISE_TYPES.has(session.exerciseType);
}

function toTrack(points: RoutePoint[]): TrackPoint[] {
  return points
    .map((point) => {
      if (point.lat == null || point.lng == null || !point.timestamp) return null;
      return {
        lat: point.lat,
        lng: point.lng,
        timestamp: new Date(point.timestamp).toISOString(),
      } satisfies TrackPoint;
    })
    .filter((p): p is TrackPoint => p !== null);
}

export const healthSync = {
  isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  },

  isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
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

    return result.workouts ?? [];
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

  async previewConsentSync(days = 14): Promise<ConsentSyncPreview> {
    const empty = { total: 0, withRoute: 0, pendingConsent: 0, alreadyImported: 0 };
    if (!this.isNativeApp() || !this.isAndroid()) return empty;

    const { sessions } = await ExerciseRoute.getExerciseSessions({ days });
    const footSessions = sessions.filter(isFootSession);
    const withRoute = footSessions.filter((s) => s.hasRoute);
    const importedIds = getImportedIds();
    const alreadyImported = footSessions.filter((s) => importedIds.has(s.recordId)).length;
    // Запрашиваем маршрут для всех неимпортированных — hasRoute из списка часто ложный (NoData).
    const pendingConsent = footSessions.length - alreadyImported;

    return {
      total: footSessions.length,
      withRoute: withRoute.length,
      pendingConsent,
      alreadyImported,
    };
  },

  isExerciseRoutePluginAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('ExerciseRoute');
  },

  async syncWithConsentFlow(
    days = 14,
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<HealthSyncResult> {
    const result: HealthSyncResult = {
      imported: 0,
      duplicates: 0,
      withoutRoute: 0,
      total: 0,
      routeAttempts: 0,
      pluginAvailable: this.isExerciseRoutePluginAvailable(),
      noDataInHealthConnect: 0,
      userDenied: 0,
    };

    if (!this.isNativeApp()) return result;

    if (!this.isAndroid()) {
      const iosResult = await this.syncRecent(days);
      return {
        ...iosResult,
        routeAttempts: 0,
        pluginAvailable: false,
        noDataInHealthConnect: 0,
        userDenied: 0,
      };
    }

    if (!result.pluginAvailable) {
      throw new Error(
        'Плагин GPS-маршрута не найден в приложении. Пересоберите APK после pnpm build && npx cap sync android.',
      );
    }

    const { sessions } = await ExerciseRoute.getExerciseSessions({ days });
    const footSessions = sessions.filter(isFootSession);
    result.total = footSessions.length;

    const importedIds = getImportedIds();
    const pendingSessions = footSessions.filter((session) => {
      if (importedIds.has(session.recordId)) {
        result.duplicates += 1;
        return false;
      }
      return true;
    });

    let progressIndex = 0;
    for (const session of pendingSessions) {
      progressIndex += 1;
      result.routeAttempts += 1;
      onProgress?.({
        current: progressIndex,
        total: pendingSessions.length,
        recordId: session.recordId,
      });

      let points: RoutePoint[] = [];
      try {
        const routeResult = await ExerciseRoute.requestRoute({ recordId: session.recordId });
        points = routeResult.points;
        if (routeResult.status === 'no_data') {
          result.noDataInHealthConnect += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/USER_DENIED/i.test(message)) {
          result.userDenied += 1;
          result.withoutRoute += 1;
          continue;
        }
        throw error;
      }

      const track = toTrack(points);
      if (track.length < 2) {
        result.withoutRoute += 1;
        continue;
      }

      const durationSeconds = Math.round(
        (new Date(session.endDate).getTime() - new Date(session.startDate).getTime()) / 1000,
      );

      try {
        await apiRequest('/activities/import-native', {
          method: 'POST',
          body: JSON.stringify({
            source: 'health_connect',
            platformId: session.recordId,
            distanceMeters: 0,
            durationSeconds,
            startedAt: new Date(session.startDate).toISOString(),
            finishedAt: new Date(session.endDate).toISOString(),
            track,
          }),
        });
        markImported(session.recordId);
        result.imported += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/already imported|duplicate/i.test(message)) {
          markImported(session.recordId);
          result.duplicates += 1;
        } else {
          throw error;
        }
      }
    }

    return result;
  },

  async syncRecent(days = 14): Promise<HealthSyncResult> {
    if (this.isAndroid()) {
      return this.syncWithConsentFlow(days);
    }

    const result: HealthSyncResult = {
      imported: 0,
      duplicates: 0,
      withoutRoute: 0,
      total: 0,
      routeAttempts: 0,
      pluginAvailable: false,
      noDataInHealthConnect: 0,
      userDenied: 0,
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
