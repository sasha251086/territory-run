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

function sourceLabel(source: string) {
  if (source === 'strava') return 'Strava';
  if (source === 'gpx_import') return 'GPX файл';
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
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showFirstCapture, setShowFirstCapture] = useState(false);
  const [captureCells, setCaptureCells] = useState(0);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [activities, connected] = await Promise.all([
        apiRequest<{ items: ActivityItem[] }>('/activities?limit=30'),
        apiRequest<IntegrationInfo[]>('/integrations'),
      ]);
      setItems(activities.items);
      setIntegrations(connected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void healthSync.isAvailable().then(setIsNativeApp);
  }, []);

  async function handleHealthSync() {
    setHealthSyncing(true);
    setMessage(null);
    try {
      const granted = await healthSync.requestPermissions();
      if (!granted) {
        setMessage('Доступ к данным здоровья не выдан. Разрешите чтение тренировок в настройках.');
        return;
      }

      const result = await healthSync.syncRecent(14);

      if (result.imported > 0) {
        setMessage(`Импортировано пробежек: ${result.imported}. Обработка займёт несколько секунд.`);
        await loadData();
        setTimeout(async () => {
          await loadData();
          await checkFirstCapture(setShowFirstCapture, setCaptureCells);
        }, 8000);
      } else if (result.withoutRoute > 0 && result.imported === 0 && result.duplicates === 0) {
        setMessage(
          `Найдено тренировок: ${result.total}, но без GPS-маршрута (${result.withoutRoute}). ` +
            'Пробежки на дорожке/в зале без GPS не захватывают территорию — нужен трек с улицы.',
        );
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

  const hasStrava = integrations.some((item) => item.provider === 'strava' && item.connected);

  if (loading) {
    return <div className="page-center">Загрузка пробежек...</div>;
  }

  return (
    <div className="stack">
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
        {message && <p className="info-box">{message}</p>}
      </section>

      <section className="card">
        <h2>История</h2>
        {items.length === 0 ? (
          <p className="muted">
            Пробежек пока нет. Загрузите GPX-файл или синхронизируйте Strava.
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
                  <span className={`status ${item.status}`}>{item.status}</span>
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
