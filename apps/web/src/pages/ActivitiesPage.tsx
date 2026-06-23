import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, apiUploadFile } from '../api/client';
import type { ActivityItem, IntegrationInfo } from '../api/types';
import FirstCaptureModal from '../components/FirstCaptureModal';
import { healthSync, formatHealthSyncMessage } from '../services/health-sync.service';
import { canReprocess, formatAnticheatMessage } from '../utils/anticheat-messages';

const RUN_PREVIEW_KEY = 'territory-run-run-preview';

function markRunPreviewAndGoToMap(navigate: (path: string) => void) {
  sessionStorage.setItem(RUN_PREVIEW_KEY, JSON.stringify({ ts: Date.now() }));
  navigate('/map?preview=1');
}

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
  if (source === 'samsung_health_zip') return 'Samsung Health (ZIP)';
  if (source === 'samsung_health') return 'Samsung Health';
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
  const navigate = useNavigate();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSamsungZip, setUploadingSamsungZip] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [healthSyncMessage, setHealthSyncMessage] = useState<string | null>(null);
  const [showFirstCapture, setShowFirstCapture] = useState(false);
  const [captureCells, setCaptureCells] = useState(0);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [healthSyncProgress, setHealthSyncProgress] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const samsungZipInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 100;

  const loadActivities = useCallback(async () => {
    let page = 1;
    let allItems: ActivityItem[] = [];
    let total = 0;

    while (page <= 100) {
      const response = await apiRequest<{
        items: ActivityItem[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/activities?page=${page}&limit=${PAGE_SIZE}`);

      total = response.total;
      allItems = [...allItems, ...response.items];

      if (allItems.length >= total || response.items.length === 0 || page >= response.totalPages) {
        break;
      }

      page += 1;
    }

    setItems(allItems);
    setTotalActivities(total);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [, connected] = await Promise.all([
        loadActivities(),
        apiRequest<IntegrationInfo[]>('/integrations'),
      ]);
      setIntegrations(connected);
    } finally {
      setLoading(false);
    }
  }, [loadActivities]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void healthSync.isAvailable().then(setIsNativeApp);
  }, []);

  async function handleHealthSync() {
    setHealthSyncing(true);
    setMessage(null);
    setHealthSyncMessage(null);
    setHealthSyncProgress(null);
    try {
      setHealthSyncProgress('Проверяем доступ к данным…');
      const granted = await healthSync.requestPermissions();
      if (!granted) {
        const text = 'Доступ к данным здоровья не выдан. Разрешите чтение тренировок в настройках.';
        setHealthSyncMessage(text);
        return;
      }

      if (healthSync.isAndroid()) {
        const samsungAvailable = await healthSync.isSamsungHealthAvailable();
        if (!samsungAvailable && !healthSync.isExerciseRoutePluginAvailable()) {
          const text =
            'Плагин GPS-маршрута не установлен. Пересоберите APK: pnpm build → npx cap sync android → Build APK.';
          setHealthSyncMessage(text);
          return;
        }

        const preview = await healthSync.previewConsentSync(14);
        if (!samsungAvailable && preview.pendingConsent > 0) {
          const confirmed = window.confirm(
            `Найдено тренировок: ${preview.total}.\n\n` +
              `Android покажет до ${preview.pendingConsent} системных запросов на доступ к GPS-маршруту ` +
              `(по одному на тренировку). Нажимайте «Разрешить» в каждом — это разовая процедура.\n\n` +
              'Продолжить?',
          );
          if (!confirmed) {
            setHealthSyncMessage('Синхронизация отменена.');
            return;
          }
        }
      }

      const result = await healthSync.syncWithConsentFlow(14, (progress) => {
        setHealthSyncProgress(
          progress.message ??
            `Запрашиваем маршрут ${progress.current} из ${progress.total}…`,
        );
      });

      const syncText = formatHealthSyncMessage(result);
      setHealthSyncMessage(syncText);

      if (result.imported > 0) {
        await loadData();
        setTimeout(async () => {
          await loadData();
          await checkFirstCapture(setShowFirstCapture, setCaptureCells);
          markRunPreviewAndGoToMap(navigate);
        }, 8000);
      }
    } catch (err) {
      setHealthSyncMessage(err instanceof Error ? err.message : 'Ошибка синхронизации с телефоном');
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
          markRunPreviewAndGoToMap(navigate);
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
        markRunPreviewAndGoToMap(navigate);
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
          markRunPreviewAndGoToMap(navigate);
        }, 8000);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось загрузить архив Samsung Health');
    } finally {
      setUploadingSamsungZip(false);
    }
  }

  async function handleReprocessFailed() {
    setReprocessing(true);
    setMessage(null);
    try {
      const result = await apiRequest<{ requeued: number; skipped: number }>(
        '/activities/reprocess-failed',
        { method: 'POST' },
      );
      setMessage(
        `В очередь на пересчёт: ${result.requeued}. Обновите список через несколько секунд.`,
      );
      setTimeout(() => void loadData(), 5000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось пересчитать пробежки');
    } finally {
      setReprocessing(false);
    }
  }

  const hasStrava = integrations.some((item) => item.provider === 'strava' && item.connected);
  const failedCount = items.filter((item) => item.status === 'failed').length;

  if (loading) {
    return <div className="page-center">Загрузка пробежек...</div>;
  }

  return (
    <div className="stack game-screen">
      <section className="screen-hero">
        <p className="eyebrow">Run Control</p>
        <h1>Пробежки</h1>
        <p>Загружайте маршруты, синхронизируйте трекеры и превращайте бег в новые зоны на карте.</p>
      </section>

      {message && (
        <section className="card">
          <p className="info-box">{message}</p>
        </section>
      )}

      <div className="action-grid">
        <section className="card highlight-card action-card">
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

        <section className="card highlight-card action-card">
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
      </div>

      {isNativeApp && (
        <section className="card highlight-card action-card">
          <h2>Синхронизация с телефоном</h2>
          <p className="muted">
            На Samsung сначала читаем GPS напрямую из Samsung Health (Data SDK).
            Если недоступно — fallback через Health Connect. На iOS — Apple Health.
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
          {healthSyncMessage && (
            <p className="info-box" style={{ marginTop: '0.75rem' }}>
              {healthSyncMessage}
            </p>
          )}
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
        {failedCount > 0 && (
          <div className="button-row" style={{ marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => void handleReprocessFailed()}
              disabled={reprocessing}
            >
              {reprocessing ? 'Пересчёт...' : 'Пересчитать отклонённые'}
            </button>
          </div>
        )}
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
                  <span className={`status ${item.status}`}>
                    {item.status === 'failed' ? 'отклонена' : item.status === 'completed' ? 'готово' : 'обработка'}
                  </span>
                  {item.status === 'failed' && (
                    <p className="anticheat-msg">{formatAnticheatMessage(item.failureReason)}</p>
                  )}
                  {item.status === 'failed' && canReprocess(item.failureReason) && (
                    <button
                      type="button"
                      className="ghost-btn small-btn"
                      onClick={() => void handleReprocessFailed()}
                      disabled={reprocessing}
                    >
                      Пересчитать
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
