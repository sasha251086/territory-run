import { Capacitor } from '@capacitor/core';
import { Health } from 'capacitor-health';
import type { Workout, RouteSample } from 'capacitor-health';
import { apiRequest } from '../api/client';
import { ExerciseRoute } from '../plugins/exercise-route';
import type { ExerciseSession, RoutePoint } from '../plugins/exercise-route';
import { SamsungHealth, isSamsungHealthAvailable } from '../plugins/samsung-health';
import type { SamsungWorkout } from '../plugins/samsung-health';

export interface HealthSyncResult {
  imported: number;
  duplicates: number;
  withoutRoute: number;
  total: number;
  routeAttempts: number;
  pluginAvailable: boolean;
  noDataInHealthConnect: number;
  userDenied: number;
  samsungHealthUsed?: boolean;
  /** Samsung SDK responded but returned zero workouts (often Developer Mode is off). */
  samsungEmpty?: boolean;
  /** Samsung permissions dialog was not fully granted. */
  samsungPermissionDenied?: boolean;
  /** Foot sessions seen in Samsung Health (including those without GPS). */
  samsungSessionsSeen?: number;
  /** Sessions skipped because route was missing in Samsung Health. */
  samsungSkippedNoRoute?: number;
  /** Which sync backend actually ran on Android. */
  syncSource?: 'samsung_health' | 'health_connect' | 'apple_health' | 'none';
}

export interface ConsentSyncPreview {
  total: number;
  withRoute: number;
  pendingConsent: number;
  alreadyImported: number;
}

export interface SyncProgress {
  current?: number;
  total?: number;
  recordId?: string;
  message?: string;
}

interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: string;
}

const READ_PERMISSIONS = ['READ_WORKOUTS', 'READ_ROUTE', 'READ_DISTANCE'] as const;
const IMPORTED_IDS_KEY = 'territory_run_health_imported_ids';
/** H3 res 9 ≈ 174 m cells — 3 s sampling at jog pace is enough for territory capture. */
const MIN_UPLOAD_INTERVAL_MS = 3000;
const MAX_UPLOAD_POINTS = 4000;

function simplifyTrackForUpload(points: TrackPoint[]): TrackPoint[] {
  if (points.length <= 2) return points;

  const simplified: TrackPoint[] = [points[0]];
  let lastKeptMs = new Date(points[0].timestamp).getTime();

  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i];
    const timeMs = new Date(point.timestamp).getTime();
    if (Number.isNaN(timeMs)) continue;
    if (timeMs - lastKeptMs >= MIN_UPLOAD_INTERVAL_MS) {
      simplified.push(point);
      lastKeptMs = timeMs;
    }
  }

  const last = points[points.length - 1];
  const lastSimplified = simplified[simplified.length - 1];
  if (lastSimplified.lat !== last.lat || lastSimplified.lng !== last.lng) {
    simplified.push(last);
  }

  if (simplified.length <= MAX_UPLOAD_POINTS) return simplified;

  const step = Math.ceil(simplified.length / MAX_UPLOAD_POINTS);
  const capped: TrackPoint[] = [];
  for (let i = 0; i < simplified.length; i += step) {
    capped.push(simplified[i]);
  }
  const cappedLast = simplified[simplified.length - 1];
  const cappedEnd = capped[capped.length - 1];
  if (cappedEnd.lat !== cappedLast.lat || cappedEnd.lng !== cappedLast.lng) {
    capped.push(cappedLast);
  }
  return capped;
}

function rethrowImportNativeError(error: unknown): never {
  const message = error instanceof Error ? error.message : '';
  if (/source must be one of the following values/i.test(message)) {
    throw new Error(
      'Сервер ещё не обновлён для Samsung Health. Попросите разработчика перезапустить API на Render, ' +
        'или загрузите ZIP-экспорт Samsung Health на этой странице.',
    );
  }
  if (/entity too large|payload too large|413/i.test(message)) {
    throw new Error(
      'GPS-маршрут слишком большой для сервера. Обновите API на Render (лимит 10 МБ) и пересоберите APK. ' +
        'Либо загрузите ZIP-экспорт Samsung Health.',
    );
  }
  throw error instanceof Error ? error : new Error(String(error));
}

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

function samsungWorkoutTrack(workout: SamsungWorkout): TrackPoint[] {
  return workout.track
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

function formatHealthSyncMessage(result: HealthSyncResult): string {
  const parts: string[] = [];

  if (result.imported > 0) {
    parts.push(
      result.samsungHealthUsed
        ? `Импортировано из Samsung Health: ${result.imported}.`
        : `Импортировано пробежек: ${result.imported}.`,
    );
  }

  if (result.duplicates > 0) {
    parts.push(`Уже были в приложении: ${result.duplicates}.`);
  }

  if (result.samsungSkippedNoRoute && result.samsungSkippedNoRoute > 0) {
    parts.push(
      `Без GPS в Samsung Health (не импортированы): ${result.samsungSkippedNoRoute}. ` +
        'Нужна уличная пробежка с GPS, не вручную.',
    );
  } else if (result.withoutRoute > 0) {
    parts.push(`Без GPS-маршрута: ${result.withoutRoute}.`);
  }

  if (parts.length > 0) {
    const tail =
      result.imported > 0
        ? ' Обработка займёт несколько секунд — обновите список.'
        : '';
    return parts.join(' ') + tail;
  }

  if (result.samsungPermissionDenied) {
    return (
      'Samsung Health не выдал все разрешения. Открой Samsung Health → ⋮ → Настройки → ' +
      'Доступ к данным → разреши Territory Run чтение «Упражнения» и «Местоположение при упражнении».'
    );
  }

  if (result.samsungHealthUsed && result.samsungEmpty) {
    return (
      'Samsung Health SDK подключён, но тренировок с GPS за 14 дней не найдено. ' +
      'Включите Developer Mode for Data Read (без Client ID): Samsung Health → Настройки → ' +
      'Сведения о Samsung Health → 10× на версию. ' +
      'Нужна пробежка, записанная с GPS на улице (не вручную и не на дорожке). ' +
      'Либо загрузите ZIP-экспорт выше на этой странице.'
    );
  }

  if (result.syncSource === 'health_connect' && result.total === 0) {
    return (
      'Health Connect не видит тренировок за 14 дней. ' +
      'Samsung Health не передаёт GPS в Health Connect — синхронизация с телефона на Samsung часто не работает без Developer Mode. ' +
      'Надёжный способ: экспорт ZIP из Samsung Health и кнопка «Загрузить ZIP» выше.'
    );
  }

  if (result.samsungHealthUsed && result.withoutRoute > 0 && result.total > 0) {
    return (
      `В Samsung Health найдено тренировок: ${result.total}, но без GPS-маршрута: ${result.withoutRoute}. ` +
      'Нужна пробежка на улице с включённым GPS.'
    );
  }

  if (result.withoutRoute > 0 && result.routeAttempts > 0) {
    if (result.noDataInHealthConnect === result.routeAttempts) {
      return (
        `Health Connect: ${result.total} тренировок, но GPS нет ни у одной. ` +
        'Samsung не передаёт маршруты в Health Connect — включите Developer Mode в Samsung Health ' +
        'или загрузите ZIP-экспорт на сайте territory-run.'
      );
    }
    return (
      `Health Connect: проверено ${result.total}, без GPS: ${result.withoutRoute}, ` +
      `отказ: ${result.userDenied}, нет маршрута: ${result.noDataInHealthConnect}.`
    );
  }

  if (result.withoutRoute > 0) {
    return (
      `Найдено тренировок: ${result.total}, но без GPS (${result.withoutRoute}). ` +
      'Нужен уличный бег с GPS.'
    );
  }

  const via =
    result.syncSource === 'samsung_health'
      ? ' (Samsung Health SDK)'
      : result.syncSource === 'health_connect'
        ? ' (Health Connect)'
        : '';

  return (
    `Нет новых тренировок с GPS за 14 дней${via} (проверено: ${result.total}). ` +
    'Тренировка, добавленная вручную без GPS, не импортируется. ' +
    'Запишите пробежку с GPS на улице или загрузите ZIP-экспорт Samsung Health.'
  );
}

function emptySyncResult(): HealthSyncResult {
  return {
    imported: 0,
    duplicates: 0,
    withoutRoute: 0,
    total: 0,
    routeAttempts: 0,
    pluginAvailable: false,
    noDataInHealthConnect: 0,
    userDenied: 0,
  };
}

export { formatHealthSyncMessage };

export const healthSync = {
  isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  },

  isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  },

  source(): 'apple_health' | 'health_connect' | 'samsung_health' {
    return Capacitor.getPlatform() === 'ios' ? 'apple_health' : 'health_connect';
  },

  async isSamsungHealthAvailable(): Promise<boolean> {
    return isSamsungHealthAvailable();
  },

  async isAvailable(): Promise<boolean> {
    if (!this.isNativeApp()) return false;
    if (this.isAndroid() && (await isSamsungHealthAvailable())) return true;
    try {
      const result = await Health.isHealthAvailable();
      return result.available;
    } catch {
      return false;
    }
  },

  async requestPermissions(): Promise<boolean> {
    if (!this.isNativeApp()) return false;

    if (this.isAndroid() && (await isSamsungHealthAvailable())) {
      try {
        const { granted } = await SamsungHealth.requestSamsungPermissions();
        if (granted) return true;
        return false;
      } catch (error) {
        console.warn('Samsung Health permissions unavailable, trying Health Connect', error);
      }
    }

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

    if (await isSamsungHealthAvailable()) {
      try {
        const { workouts } = await SamsungHealth.getExercisesWithLocation({ days });
        const withRoute = workouts.filter((workout) => workout.track.length >= 2);
        const importedIds = getImportedIds();
        const alreadyImported = workouts.filter((w) => importedIds.has(w.platformId)).length;
        return {
          total: workouts.length,
          withRoute: withRoute.length,
          pendingConsent: workouts.length - alreadyImported,
          alreadyImported,
        };
      } catch {
        // Fall back to Health Connect preview below.
      }
    }

    const { sessions } = await ExerciseRoute.getExerciseSessions({ days });
    const footSessions = sessions.filter(isFootSession);
    const withRoute = footSessions.filter((s) => s.hasRoute);
    const importedIds = getImportedIds();
    const alreadyImported = footSessions.filter((s) => importedIds.has(s.recordId)).length;
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

  async syncViaSamsungHealth(
    days: number,
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<HealthSyncResult | null> {
    const available = await isSamsungHealthAvailable();
    if (!available) return null;

    let workouts: SamsungWorkout[] = [];
    let sessionsSeen = 0;
    let skippedNoRoute = 0;
    try {
      onProgress?.({ message: 'Читаем пробежки с GPS из Samsung Health…' });
      const samsungData = await SamsungHealth.getExercisesWithLocation({ days });
      workouts = samsungData.workouts;
      sessionsSeen = samsungData.sessionsSeen ?? workouts.length;
      skippedNoRoute = samsungData.skippedNoRoute ?? 0;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Samsung Health: не удалось прочитать тренировки (${detail})`);
    }

    const result: HealthSyncResult = {
      ...emptySyncResult(),
      total: workouts.length,
      withoutRoute: skippedNoRoute,
      pluginAvailable: true,
      samsungHealthUsed: true,
      samsungEmpty: workouts.length === 0 && sessionsSeen === 0,
      samsungSessionsSeen: sessionsSeen,
      samsungSkippedNoRoute: skippedNoRoute,
      syncSource: 'samsung_health',
    };

    let uploadIndex = 0;
    for (const workout of workouts) {
      const rawTrack = samsungWorkoutTrack(workout);
      if (rawTrack.length < 2) {
        result.withoutRoute += 1;
        continue;
      }
      const track = simplifyTrackForUpload(rawTrack);
      uploadIndex += 1;
      onProgress?.({
        current: uploadIndex,
        total: workouts.length,
        recordId: workout.platformId,
        message: `Отправляем пробежку ${uploadIndex} из ${workouts.length}…`,
      });

      const durationSeconds =
        workout.durationSeconds > 0
          ? workout.durationSeconds
          : Math.round(
              (new Date(workout.endDate).getTime() - new Date(workout.startDate).getTime()) / 1000,
            );

      try {
        await apiRequest('/activities/import-native', {
          method: 'POST',
          body: JSON.stringify({
            source: 'samsung_health',
            platformId: workout.platformId,
            distanceMeters: workout.distanceMeters,
            durationSeconds,
            startedAt: new Date(workout.startDate).toISOString(),
            finishedAt: new Date(workout.endDate).toISOString(),
            track,
          }),
        });
        markImported(workout.platformId);
        result.imported += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/already imported|duplicate/i.test(message)) {
          markImported(workout.platformId);
          result.duplicates += 1;
        } else {
          rethrowImportNativeError(error);
        }
      }
    }

    // Always stop here when Samsung SDK is active — do not silently fall back to Health Connect.
    return result;
  },

  async syncViaHealthConnect(
    days: number,
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<HealthSyncResult> {
    const result: HealthSyncResult = {
      ...emptySyncResult(),
      pluginAvailable: this.isExerciseRoutePluginAvailable(),
      syncSource: 'health_connect',
    };

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

      const rawTrack = toTrack(points);
      if (rawTrack.length < 2) {
        result.withoutRoute += 1;
        continue;
      }
      const track = simplifyTrackForUpload(rawTrack);

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
          rethrowImportNativeError(error);
        }
      }
    }

    return result;
  },

  async syncWithConsentFlow(
    days = 14,
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<HealthSyncResult> {
    if (!this.isNativeApp()) return emptySyncResult();

    if (!this.isAndroid()) {
      const iosResult = await this.syncRecent(days);
      return {
        ...iosResult,
        routeAttempts: 0,
        pluginAvailable: false,
        noDataInHealthConnect: 0,
        userDenied: 0,
        syncSource: 'apple_health',
      };
    }

    const samsungResult = await this.syncViaSamsungHealth(days, onProgress);
    if (samsungResult) {
      return samsungResult;
    }

    return this.syncViaHealthConnect(days, onProgress);
  },

  async syncRecent(days = 14): Promise<HealthSyncResult> {
    if (this.isAndroid()) {
      return this.syncWithConsentFlow(days);
    }

    const result = emptySyncResult();

    if (!this.isNativeApp()) return result;

    const workouts = await this.getRecentWorkouts(days);
    result.total = workouts.length;
    const source = this.source();

    for (const workout of workouts) {
      const rawTrack = this.extractRoute(workout);
      if (rawTrack.length < 2) {
        result.withoutRoute += 1;
        continue;
      }
      const track = simplifyTrackForUpload(rawTrack);

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
          rethrowImportNativeError(error);
        }
      }
    }

    return result;
  },
};
