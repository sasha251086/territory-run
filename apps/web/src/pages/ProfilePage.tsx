import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { IntegrationInfo } from '../api/types';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await apiRequest<IntegrationInfo[]>('/integrations');
      setIntegrations(data);
    }
    void load();
  }, []);

  async function connectStrava() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await apiRequest<{ authUrl: string }>('/integrations/strava/connect', {
        method: 'POST',
      });
      window.location.href = data.authUrl;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось открыть Strava');
      setLoading(false);
    }
  }

  const stravaConnected = integrations.some(
    (item) => item.provider === 'strava' && item.connected,
  );

  return (
    <div className="stack">
      <section className="card">
        <h2>Профиль</h2>
        <p><strong>{user?.nickname}</strong></p>
        <p className="muted">{user?.email}</p>
        <div className="stats-grid">
          <div><span>Клетки</span><strong>{user?.stats?.cellsOwned ?? 0}</strong></div>
          <div><span>Влияние</span><strong>{Math.round(user?.stats?.totalInfluence ?? 0)}</strong></div>
          <div><span>Пробежки</span><strong>{user?.stats?.totalRuns ?? 0}</strong></div>
        </div>
      </section>

      <section className="card highlight-card">
        <h2>Подключённые источники</h2>
        <p className="muted">
          Это главный способ получить пробежки в Territory Run. Подключите Strava, пробегите в привычном приложении и синхронизируйте.
        </p>

        <div className="integration-row">
          <div>
            <strong>Strava</strong>
            <p>{stravaConnected ? 'Подключено' : 'Не подключено'}</p>
          </div>
          {!stravaConnected && (
            <button type="button" className="primary-btn" onClick={connectStrava} disabled={loading}>
              Подключить Strava
            </button>
          )}
        </div>

        <p className="muted small">
          Apple Health и Health Connect недоступны из браузера — это ограничение iOS/Android, не приложения.
        </p>

        {message && <p className="error-banner">{message}</p>}
      </section>

      <section className="card">
        <h3>Домашняя база</h3>
        <p className="muted">
          {user?.homeLat != null && user.homeLng != null
            ? `Координаты: ${user.homeLat.toFixed(5)}, ${user.homeLng.toFixed(5)}`
            : 'Домашняя база не выбрана'}
        </p>
        <button type="button" className="ghost-btn" onClick={() => void refreshProfile()}>
          Обновить профиль
        </button>
      </section>
    </div>
  );
}
