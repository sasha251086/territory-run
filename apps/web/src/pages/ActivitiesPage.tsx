import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { ActivityItem, IntegrationInfo } from '../api/types';
import FirstCaptureModal from '../components/FirstCaptureModal';

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(2)} км`;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return `${mins} мин`;
}

function sourceLabel(source: string) {
  if (source === 'strava') return 'Strava';
  if (source === 'apple_health') return 'Apple Health';
  if (source === 'health_connect') return 'Health Connect';
  return source;
}

export default function ActivitiesPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showFirstCapture, setShowFirstCapture] = useState(false);
  const [captureCells, setCaptureCells] = useState(0);

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
          const refreshed = await apiRequest<{ items: ActivityItem[] }>('/activities?limit=30');
          setItems(refreshed.items);
          const completed = refreshed.items.filter((item) => item.status === 'completed');
          if (completed.length > 0) {
            const profile = await apiRequest<{ stats: { cellsOwned: number; firstCaptureShownAt: string | null } | null }>(
              '/users/me',
            );
            if (!profile.stats?.firstCaptureShownAt && (profile.stats?.cellsOwned ?? 0) > 0) {
              setCaptureCells(profile.stats?.cellsOwned ?? 0);
              setShowFirstCapture(true);
            }
          }
        }, 8000);
      } else if (result.imported === 0) {
        setMessage('Новых пробежек не найдено. Как только появится бег в Strava, он появится здесь.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка синхронизации');
    } finally {
      setSyncing(false);
    }
  }

  const hasStrava = integrations.some((item) => item.provider === 'strava' && item.connected);

  if (loading) {
    return <div className="page-center">Загрузка пробежек...</div>;
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Импорт пробежек</h2>
        <p className="muted">
          Territory Run получает тренировки из подключённых сервисов. Запишите пробежку в Strava и нажмите синхронизацию.
        </p>
        {hasStrava ? (
          <button type="button" className="primary-btn" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Синхронизация...' : 'Синхронизировать сейчас'}
          </button>
        ) : (
          <p className="warning-box">
            Strava не подключена. Перейдите в Профиль и подключите источник данных.
          </p>
        )}
        {message && <p className="info-box">{message}</p>}
      </section>

      <section className="card">
        <h2>История</h2>
        {items.length === 0 ? (
          <p className="muted">
            Пробежек пока нет. Подключите Strava в профиле и синхронизируйте тренировки.
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
