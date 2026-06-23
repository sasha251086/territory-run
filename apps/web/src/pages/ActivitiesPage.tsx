import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, apiUploadFile } from '../api/client';
import type { ActivityItem, IntegrationInfo } from '../api/types';
import FirstCaptureModal from '../components/FirstCaptureModal';
import { healthSync } from '../services/health-sync.service';

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(2)} км`;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return `${mins} мин`;
}

function formatSamsungImportMessage(result: {
  imported: number;
  duplicates: number;
  withoutRoute: number;
  total: number;
  skippedByDate?: number;
  withGps?: number;
  hint?: string;
}) {
  if (result.imported > 0) {
    return (
      `Импортировано пробежек: ${result.imported}. ` +
      `Пропущено (уже были): ${result.duplicates}. ` +
      `Без GPS: ${result.withoutRoute}. ` +
      'Открой «Карта» → «Показать мои клетки».'
    );
  }
  if (result.duplicates > 0) {
    return `Новых пробежек нет — все ${result.duplicates} уже импортированы.`;
  }
  const parts = [
    `Тренировок в архиве: ${result.total}.`,
    result.withGps != null ? `С GPS: ${result.withGps}.` : '',
    result.withoutRoute ? `Без GPS: ${result.withoutRoute}.` : '',
    result.skippedByDate ? `Слишком старые: ${result.skippedByDate}.` : '',
    result.hint ?? 'За последние 365 дней импортировать нечего.',
  ];
  return parts.filter(Boolean).join(' ');
}

function sourceLabel(source: string) {
  if (source === 'strava') return 'Strava';
  if (source === 'gpx_import') return 'GPX файл';
  if (source === 'samsung_health_zip') return 'Samsung Health';
  if (source === 'apple_health') return 'Apple Health';
  if (source === 'health_connect') return 'Health Connect';
  return source;
}

async function checkFirstCapture(setShow: (v: boolean) => void, setCells: (n: number) => void) {
  const profile = await apiRequest<{ stats: { cellsOwned: number; firstCaptureShownAt: string | null } | null }>(
    '/users/me',
  );
  if (!profile.stats?.firstCaptureShownAt && (profile.stats?.cellsOwned ?? 0) > 0) {
    setCells(profile.stats?.cellsOwned ?? 0);
    setShow(true);
  }
}

export default function ActivitiesPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSamsungZip, setUploadingSamsungZip] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showFirstCapture, setShowFirstCapture] = useState(false);
  const [captureCells, setCaptureCells] = useState(0);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [healthSyncProgress, setHealthSyncProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const samsungZipInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 50;

  const loadActivities = useCallback(async (page: number, append: boolean) => {
    const activities = await apiRequest<{
      items: ActivityItem[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/activities?page=${page}&limit=${PAGE_SIZE}`);

    setItems((prev) => (append ? [...prev, ...activities.items] : activities.items));
    setTotalActivities(activities.total);
    setActivitiesPage(activities.page);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [, connected] = await Promise.all([
        loadActivities(1, false),
        apiRequest<IntegrationInfo[]>('/integrations'),
      ]);
      setIntegrations(connected);
    } finally {
      setLoading(false);
    }
  }, [loadActivities]);

  async function handleLoadMore() {
    if (items.length >= totalActivities) return;
    setLoadingMore(true);
    try {
      await loadActivities(activitiesPage + 1, true);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void healthSync.isAvailable().then(setIsNativeApp);
  }, []);

  async function handleHealthSync() {
    setHealthSyncing(true);
    setMessage(null);
    setHealthSyncProgress(null);
    try {
      const granted = await healthSync.requestPermissions();
      if (!granted) {
        setMessage('Доступ к данным здоровья не выдан. Разрешите чтение тренировок в настройках.');
        return;
      }

      if (healthSync.isAndroid()) {
        if (!healthSync.isExerciseRoutePluginAvailable()) {
          setMessage(
            'Плагин GPS-маршрута не установлен. Пересоберите APK: pnpm build → npx cap sync android → Build APK.',
          );
          return;
        }

        const preview = await healthSync.previewConsentSync(14);
        if (preview.pendingConsent > 0) {
          const confirmed = window.confirm(
            `Найдено тренировок: ${preview.total}.\n\n` +
              `Android покажет до ${preview.pendingConsent} системных запросов на доступ к GPS-маршруту ` +
              `(по одному на тренировку). Нажимайте «Разрешить» в каждом — это разовая процедура.\n\n` +
              'Продолжить?',
          );
          if (!confirmed) {
            setMessage('Синхронизация отменена.');
            return;
          }
        }
      }

      const result = await healthSync.syncWithConsentFlow(14, (progress) => {
        setHealthSyncProgress(`Запрашиваем маршрут ${progress.current} из ${progress.total}…`);
      });

      if (result.imported > 0) {
        setMessage(`Импортировано пробежек: ${result.imported}. Обработка займёт несколько секунд.`);
        await loadData();
        setTimeout(async () => {
          await loadData();
          await checkFirstCapture(setShowFirstCapture, setCaptureCells);
        }, 8000);
      } else if (result.withoutRoute > 0 && result.imported === 0 && result.duplicates === 0) {
        if (result.routeAttempts > 0) {
          if (result.noDataInHealthConnect === result.routeAttempts) {
            setMessage(
              `Плагин работает: проверено ${result.total} тренировок, запросов маршрута ${result.routeAttempts}. ` +
                'Health Connect ответил «маршрута нет» по всем — Samsung Health не передаёт GPS в Health Connect. ' +
                'Проверь: открой приложение Health Connect → Упражнения → выбери пробежку → есть ли карта маршрута? ' +
                'Если карты нет — загрузите ZIP из Samsung Health (раздел выше), Strava или GPX.',
            );
          } else {
            setMessage(
              `Проверено тренировок: ${result.total}. Запросов маршрута: ${result.routeAttempts}, ` +
                `без GPS: ${result.withoutRoute}, отказ: ${result.userDenied}, нет в HC: ${result.noDataInHealthConnect}. ` +
                'Если системные диалоги не появлялись — пересоберите APK.',
            );
          }
        } else {
          setMessage(
            `Найдено тренировок: ${result.total}, но без GPS-маршрута (${result.withoutRoute}). ` +
              'Пробежки на дорожке/в зале без GPS не захватывают территорию — нужен трек с улицы.',
          );
        }
      } else if (result.duplicates > 0 && result.imported === 0) {
        setMessage('Новых пробежек нет — все уже импортированы.');
      } else {
        setMessage(
          `В Health Connect нет тренировок за 14 дней (проверено: ${result.total}). ` +
            'Открой Samsung Health → Настройки → Health Connect и включи передачу «Тренировки» и «Маршрут», ' +
            'затем убедись, что есть хотя бы одна уличная пробежка с GPS.',
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка синхронизации с телефоном');
    } finally {
      setHealthSyncing(false);
      setHealthSyncProgress(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const result = await apiRequest<{ imported: number; skipped: number }>(
        '/integrations/strava/sync',
        { method: 'POST' },
      );
      setMessage(`Импортировано: ${result.imported}, пропущено: ${result.skipped}`);
      await loadData();

      if (result.imported > 0) {
        setTimeout(async () => {
          await loadData();
          await checkFirstCapture(setShowFirstCapture, setCaptureCells);
        }, 8000);
      } else {
        setMessage('Новых пробежек не найдено. Как только появится бег в Strava, он появится здесь.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка синхронизации');
    } finally {
      setSyncing(false);
    }
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const result = await apiUploadFile<{ activityId: string; status: string }>(
        '/activities/import',
        file,
      );
      setMessage(`Файл загружен. Статус: ${result.status}. Обработка займёт несколько секунд.`);
      await loadData();

      setTimeout(async () => {
        await loadData();
        await checkFirstCapture(setShowFirstCapture, setCaptureCells);
      }, 8000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
    }
  }

  async function handleSamsungZipSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (file.size > 350 * 1024 * 1024) {
      setMessage(
        `Архив слишком большой (${Math.round(file.size / 1024 / 1024)} МБ, лимит 350 МБ). ` +
          'Заархивируй только папку jsons/com.samsung.shealth.exercise.',
      );
      return;
    }

    setUploadingSamsungZip(true);
    setMessage(null);
    try {
      const result = await apiUploadFile<{
        imported: number;
        duplicates: number;
        withoutRoute: number;
        total: number;
        skippedByDate?: number;
        withGps?: number;
        hint?: string;
      }>('/activities/import-samsung-zip?days=365', file);

      setMessage(formatSamsungImportMessage(result));

      if (result.imported > 0) {
        await loadData();
        setTimeout(async () => {
          await loadData();
          await checkFirstCapture(setShowFirstCapture, setCaptureCells);
        }, 8000);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось загрузить архив Samsung Health');
    } finally {
      setUploadingSamsungZip(false);
    }
  }

  const hasStrava = integrations.some((item) => item.provider === 'strava' && item.connected);

  if (loading) {
    return <div className="page-center">Загрузка пробежек...</div>;
  }

  return (
    <div className="stack">
      {message && (
        <section className="card">
          <p className="info-box">{message}</p>
        </section>
      )}

      <section className="card highlight-card">
        <h2>Загрузить ZIP из Samsung Health</h2>
        <p className="muted">
          Samsung Health не передаёт GPS-маршруты в Health Connect, но хранит их в архиве персональных данных.
          Открой Samsung Health → Настройки → Загрузить персональные данные → заархивируй{' '}
          <strong>корневую папку экспорта</strong> (где лежат CSV и папка jsons/) и загрузи ZIP сюда.
          Если архив больше 350 МБ — упакуй только папку jsons/com.samsung.shealth.exercise.
        </p>
        <input
          ref={samsungZipInputRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={handleSamsungZipSelected}
        />
        <button
          type="button"
          className="primary-btn"
          onClick={() => samsungZipInputRef.current?.click()}
          disabled={uploadingSamsungZip}
        >
          {uploadingSamsungZip ? 'Разбор архива...' : 'Загрузить ZIP Samsung Health'}
        </button>
      </section>

      <section className="card highlight-card">
        <h2>Загрузить GPX файл</h2>
        <p className="muted">
          Экспортируйте пробежку из Samsung Health, Garmin, Nike или другого приложения в формат GPX и загрузите файл сюда.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx"
          hidden
          onChange={handleFileSelected}
        />
        <button
          type="button"
          className="primary-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Загрузка...' : 'Загрузить трек'}
        </button>
      </section>

      {isNativeApp && (
        <section className="card highlight-card">
          <h2>Синхронизация с телефоном</h2>
          <p className="muted">
            Territory Run прочитает пробежки за последние 14 дней напрямую из
            здоровья телефона (Health Connect / Apple Health) и сам захватит территории.
          </p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handleHealthSync()}
            disabled={healthSyncing}
          >
            {healthSyncing ? 'Синхронизация...' : 'Синхронизировать пробежки'}
          </button>
          {healthSyncProgress && <p className="muted small">{healthSyncProgress}</p>}
        </section>
      )}

      <section className="card">
        <h2>Strava (опционально)</h2>
        <p className="muted">
          Если Strava подключена, можно синхронизировать пробежки автоматически.
        </p>
        {hasStrava ? (
          <button type="button" className="ghost-btn" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Синхронизация...' : 'Синхронизировать Strava'}
          </button>
        ) : (
          <p className="muted small">
            Strava не подключена — это необязательно, GPX-файла достаточно.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Мои пробежки</h2>
        {totalActivities > 0 && (
          <p className="muted small">
            Показано {items.length} из {totalActivities}
          </p>
        )}
        {items.length === 0 ? (
          <p className="muted">
            Пробежек пока нет. Загрузите ZIP из Samsung Health, GPX-файл или синхронизируйте Strava.
          </p>
        ) : (
          <>
            <ul className="list">
              {items.map((item) => (
                <li key={item.id} className="list-item">
                  <div>
                    <strong>{sourceLabel(item.source)}</strong>
                    <p>{new Date(item.startedAt).toLocaleString('ru-RU')}</p>
                  </div>
                  <div className="list-meta">
                    <span>{formatDistance(item.distanceMeters)}</span>
                    <span>{formatDuration(item.durationSeconds)}</span>
                    <span className={`status ${item.status}`}>{item.status}</span>
                    {item.status === 'failed' && item.failureReason && (
                      <span className="muted small"> ({item.failureReason})</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {items.length < totalActivities && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
                style={{ marginTop: '1rem' }}
              >
                {loadingMore ? 'Загрузка...' : `Загрузить ещё (${totalActivities - items.length})`}
              </button>
            )}
          </>
        )}
      </section>

      {showFirstCapture && (
        <FirstCaptureModal
          cellsCaptured={captureCells}
          onClose={() => setShowFirstCapture(false)}
        />
      )}
    </div>
  );
}
