import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, apiUploadFile } from '../api/client';
import type { ActivityItem, IntegrationInfo } from '../api/types';
import ActivityCard from '../components/ActivityCard';
import ActivityResultsModal from '../components/ActivityResultsModal';
import FirstCaptureModal from '../components/FirstCaptureModal';
import GameTutorialModal from '../components/GameTutorialModal';
import { useActivityStatusPoll, type ActivityStatusResult } from '../hooks/useActivityStatusPoll';
import { healthSync, formatHealthSyncMessage } from '../services/health-sync.service';
import { useAuth } from '../context/AuthContext';

const RUN_PREVIEW_KEY = 'territory-run-run-preview';

function markRunPreviewAndGoToMap(navigate: (path: string) => void) {
  sessionStorage.setItem(RUN_PREVIEW_KEY, JSON.stringify({ ts: Date.now() }));
  navigate('/?preview=1');
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
  const { user, refreshProfile } = useAuth();
  const { pollActivity } = useActivityStatusPoll();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSamsungZip, setUploadingSamsungZip] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [healthSyncMessage, setHealthSyncMessage] = useState<string | null>(null);
  const [showFirstCapture, setShowFirstCapture] = useState(false);
  const [captureCells, setCaptureCells] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [resultsModal, setResultsModal] = useState<ActivityStatusResult | null>(null);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [healthSyncProgress, setHealthSyncProgress] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
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

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      ),
    [items],
  );

  const importBusy = uploading || uploadingSamsungZip || syncing || healthSyncing;

  function watchActivity(activityId: string) {
    pollActivity(activityId, {
      onComplete: async (result) => {
        await loadData();
        await refreshProfile();
        await checkFirstCapture(setShowFirstCapture, setCaptureCells);
        if (!user?.stats?.gameTutorialShownAt) {
          setShowTutorial(true);
        }
        setResultsModal(result);
      },
      onFailed: async () => {
        await loadData();
      },
    });
  }

  function dismissResults() {
    setResultsModal(null);
    markRunPreviewAndGoToMap(navigate);
  }

  async function dismissTutorial() {
    setShowTutorial(false);
    try {
      await apiRequest('/users/me/game-tutorial-shown', { method: 'POST' });
      await refreshProfile();
    } catch {
      // non-blocking
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [, connected] = await Promise.all([
        loadActivities(),
        apiRequest<IntegrationInfo[]>('/integrations'),
      ]);
      setIntegrations(connected);
    } catch (err) {
      setItems([]);
      setTotalActivities(0);
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось загрузить пробежки');
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
    setErrorMessage(null);
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
        const latest = await apiRequest<{
          items: Array<{ id: string; status: string }>;
        }>('/activities?page=1&limit=5');
        const processing = latest.items.find((item) => item.status === 'processing');
        if (processing) {
          watchActivity(processing.id);
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Ошибка синхронизации с телефоном');
    } finally {
      setHealthSyncing(false);
      setHealthSyncProgress(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const result = await apiRequest<{ imported: number; skipped: number }>(
        '/integrations/strava/sync',
        { method: 'POST' },
      );
      setMessage(`Импортировано: ${result.imported}, пропущено: ${result.skipped}`);
      await loadData();

      if (result.imported > 0) {
        const latest = await apiRequest<{
          items: Array<{ id: string; status: string }>;
        }>('/activities?page=1&limit=5');
        const processing = latest.items.find((item) => item.status === 'processing');
        if (processing) {
          watchActivity(processing.id);
        }
      } else {
        setMessage('Новых пробежек не найдено. Как только появится бег в Strava, он появится здесь.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Ошибка синхронизации');
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
    setErrorMessage(null);
    try {
      const result = await apiUploadFile<{ activityId: string; status: string }>(
        '/activities/import',
        file,
      );
      setMessage(`Файл загружен. Статус: ${result.status}. Обработка займёт несколько секунд.`);
      await loadData();
      watchActivity(result.activityId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось загрузить файл');
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
      setErrorMessage(
        `Архив слишком большой (${Math.round(file.size / 1024 / 1024)} МБ, лимит 350 МБ). ` +
          'Заархивируй только папку jsons/com.samsung.shealth.exercise.',
      );
      return;
    }

    setUploadingSamsungZip(true);
    setMessage(null);
    setErrorMessage(null);
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
        const latest = await apiRequest<{
          items: Array<{ id: string; status: string }>;
        }>('/activities?page=1&limit=5');
        const processing = latest.items.find((item) => item.status === 'processing');
        if (processing) {
          watchActivity(processing.id);
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось загрузить архив Samsung Health');
    } finally {
      setUploadingSamsungZip(false);
    }
  }

  async function handleReprocessFailed() {
    setReprocessing(true);
    setMessage(null);
    setErrorMessage(null);
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
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось пересчитать пробежки');
    } finally {
      setReprocessing(false);
    }
  }

  const hasStrava = integrations.some((item) => item.provider === 'strava' && item.connected);
  const failedCount = items.filter((item) => item.status === 'failed').length;

  function handleHealthAction() {
    if (isNativeApp) {
      void handleHealthSync();
      return;
    }
    samsungZipInputRef.current?.click();
  }

  if (loading) {
    return <div className="page-center">Загрузка пробежек…</div>;
  }

  return (
    <div className="page-screen page-screen--runs">
      <h1 className="page-title">Пробежки</h1>

      <button
        type="button"
        className="primary-btn runs-add-btn"
        onClick={() => setImportMenuOpen(true)}
        disabled={importBusy}
      >
        {importBusy ? 'Импорт…' : '+ Добавить пробежку'}
      </button>

      {importMenuOpen && (
        <div
          className="bottom-sheet-backdrop"
          onClick={() => setImportMenuOpen(false)}
          role="presentation"
        >
          <section
            className="bottom-sheet import-sheet"
            role="dialog"
            aria-label="Как добавить пробежку"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bottom-sheet-handle" aria-hidden="true" />
            <p className="import-sheet-title">Добавить пробежку</p>
            <div className="import-sheet-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setImportMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                disabled={importBusy}
              >
                GPX файл
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setImportMenuOpen(false);
                  void handleSync();
                }}
                disabled={!hasStrava || importBusy}
              >
                Strava
                {!hasStrava && <span className="muted small"> · не подключена</span>}
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setImportMenuOpen(false);
                  handleHealthAction();
                }}
                disabled={importBusy}
              >
                {isNativeApp ? 'Samsung Health (телефон)' : 'Samsung Health (архив ZIP)'}
              </button>
            </div>
          </section>
        </div>
      )}

      {message && <p className="info-box">{message}</p>}
      {errorMessage && <p className="error-banner">{errorMessage}</p>}
      {healthSyncProgress && <p className="muted small">{healthSyncProgress}</p>}
      {healthSyncMessage && <p className="info-box">{healthSyncMessage}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx"
        hidden
        onChange={handleFileSelected}
      />
      <input
        ref={samsungZipInputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={handleSamsungZipSelected}
      />

      {failedCount > 0 && (
        <div className="button-row">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => void handleReprocessFailed()}
            disabled={reprocessing}
          >
            {reprocessing ? 'Пересчёт…' : 'Пересчитать отклонённые'}
          </button>
        </div>
      )}

      {totalActivities > 0 && (
        <p className="muted small run-list-meta">
          Показано {sortedItems.length} из {totalActivities}
        </p>
      )}

      {sortedItems.length === 0 ? (
        <div className="empty-state">
          <h3>Пока нет пробежек</h3>
          <p className="muted">Загрузите GPX, Strava или Health — и захватите клетки на карте.</p>
        </div>
      ) : (
        <div className="run-list-scroll">
          <ul className="run-list">
            {sortedItems.map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
                onReprocess={() => void handleReprocessFailed()}
                reprocessing={reprocessing}
              />
            ))}
          </ul>
        </div>
      )}

      {showFirstCapture && (
        <FirstCaptureModal
          cellsCaptured={captureCells}
          onClose={() => setShowFirstCapture(false)}
        />
      )}

      {showTutorial && <GameTutorialModal onClose={() => void dismissTutorial()} />}

      {resultsModal && (
        <ActivityResultsModal
          result={resultsModal}
          cellsOwned={user?.stats?.cellsOwned ?? 0}
          onDismiss={dismissResults}
        />
      )}
    </div>
  );
}
