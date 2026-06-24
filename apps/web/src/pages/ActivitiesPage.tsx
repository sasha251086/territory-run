import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, apiUploadFile } from '../api/client';
import type { ActivityItem, ActivityResult, IntegrationInfo } from '../api/types';
import ActivityCard from '../components/ActivityCard';
import FirstCaptureModal from '../components/FirstCaptureModal';
import RunCelebrationOverlay from '../components/RunCelebrationOverlay';
import { healthSync, formatHealthSyncMessage } from '../services/health-sync.service';

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
  const [items, setItems] = useState<ActivityItem[]>([]);
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
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<ActivityResult | null>(null);
  const polledCompletedRef = useRef<Set<string>>(new Set());
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

  useEffect(() => {
    const processing = items.filter((item) => item.status === 'processing');
    if (processing.length === 0) return;

    const interval = window.setInterval(() => {
      void (async () => {
        for (const item of processing) {
          try {
            const status = await apiRequest<{ status: string }>(`/activities/${item.id}/status`);
            if (status.status !== 'completed' && status.status !== 'failed') continue;
            await loadActivities();
            if (status.status === 'completed' && !polledCompletedRef.current.has(item.id)) {
              polledCompletedRef.current.add(item.id);
              try {
                const result = await apiRequest<ActivityResult>(`/activities/${item.id}/result`);
                setRunResult(result);
                await checkFirstCapture(setShowFirstCapture, setCaptureCells);
              } catch {
                setMessage('Пробежка обработана. Откройте карту, чтобы увидеть изменения.');
              }
            }
          } catch {
            // ignore polling errors
          }
        }
      })();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [items, loadActivities]);

  async function handleReprocessOne(activityId: string) {
    setReprocessingId(activityId);
    setReprocessError(null);
    try {
      await apiRequest(`/activities/${activityId}/reprocess`, { method: 'POST' });
      await loadActivities();
    } catch (err) {
      setReprocessError(
        err instanceof Error ? err.message : 'Не удалось пересчитать. Попробуйте позже.',
      );
    } finally {
      setReprocessingId(null);
    }
  }

  function goToMapWithHighlight(indices: string[]) {
    if (indices.length === 0) {
      navigate('/');
      return;
    }
    navigate(`/?highlight=${encodeURIComponent(indices.join(','))}`);
  }

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
        await loadData();
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

  function connectStravaRedirect() {
    setMessage('Подключите Strava в профиле, затем синхронизируйте пробежки.');
  }

  if (loading) {
    return <div className="page-center">Загрузка пробежек...</div>;
  }

  return (
    <div className="tr-screen">
      <h1 className="tr-screen__title">Пробежки</h1>

      <div className="tr-source-row">
        <button
          type="button"
          className="tr-source-btn tr-source-btn--strava"
          onClick={hasStrava ? handleSync : connectStravaRedirect}
          disabled={syncing}
        >
          Strava
        </button>
        <button
          type="button"
          className="tr-source-btn tr-source-btn--teal"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          GPX файл
        </button>
        <button
          type="button"
          className="tr-source-btn tr-source-btn--teal"
          onClick={() => (isNativeApp ? void handleHealthSync() : samsungZipInputRef.current?.click())}
          disabled={healthSyncing || uploadingSamsungZip}
        >
          {isNativeApp ? 'Данные здоровья' : 'Samsung ZIP'}
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".gpx" hidden onChange={handleFileSelected} />
      <input ref={samsungZipInputRef} type="file" accept=".zip,application/zip" hidden onChange={handleSamsungZipSelected} />

      {message && <p className="info-box tr-glass" style={{ padding: 12 }}>{message}</p>}
      {healthSyncProgress && <p className="muted small">{healthSyncProgress}</p>}
      {healthSyncMessage && <p className="info-box tr-glass" style={{ padding: 12 }}>{healthSyncMessage}</p>}

      {failedCount > 0 && (
        <button type="button" className="tr-btn tr-btn-secondary" onClick={() => void handleReprocessFailed()} disabled={reprocessing}>
          {reprocessing ? 'Пересчёт…' : `Пересчитать отклонённые (${failedCount})`}
        </button>
      )}

      {items.length === 0 ? (
        <p className="muted tr-glass" style={{ padding: 14 }}>
          Пробежек пока нет. Импортируйте через Strava, GPX или архив Samsung Health.
        </p>
      ) : (
        <ul className="activity-list" style={{ margin: 0, padding: 0 }}>
          {items.map((item) => (
            <ActivityCard
              key={item.id}
              item={item}
              onReprocess={handleReprocessOne}
              reprocessing={reprocessingId === item.id}
              reprocessError={reprocessingId === item.id ? reprocessError : null}
            />
          ))}
        </ul>
      )}

      {showFirstCapture && (
        <FirstCaptureModal cellsCaptured={captureCells} onClose={() => setShowFirstCapture(false)} />
      )}

      {runResult && (
        <RunCelebrationOverlay
          title="Пробежка засчитана!"
          subtitle={`Новых клеток: +${runResult.newCellsCount} · Захвачено: ${runResult.capturedCellsCount}`}
          distanceKm={
            runResult.distanceMeters != null ? runResult.distanceMeters / 1000 : undefined
          }
          cellsGained={runResult.newCellsCount}
          influenceGained={runResult.influenceGained}
          onDismiss={() => {
            const indices = runResult.affectedH3Indices;
            setRunResult(null);
            goToMapWithHighlight(indices);
          }}
          onShare={() => {
            const text = `Territory Run: +${runResult.newCellsCount} клеток, +${Math.round(runResult.influenceGained)} влияния!`;
            if (navigator.share) void navigator.share({ text, title: 'Territory Run' });
          }}
        />
      )}
    </div>
  );
}
