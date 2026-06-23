import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { IntegrationInfo } from '../api/types';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

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

  async function handleRefreshProfile() {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      await refreshProfile();
      setRefreshMessage('Статистика обновлена');
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : 'Не удалось обновить профиль');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="stack game-screen">
      <section className="screen-hero profile-hero">
        <p className="eyebrow">Runner Profile</p>
        <h1>{user?.nickname}</h1>
        <p>{user?.email}</p>
        <div className="stats-grid hero-stats">
          <div><span>Клетки</span><strong>{user?.stats?.cellsOwned ?? 0}</strong></div>
          <div><span>Влияние</span><strong>{Math.round(user?.stats?.totalInfluence ?? 0)}</strong></div>
          <div><span>Пробежки</span><strong>{user?.stats?.totalRuns ?? 0}</strong></div>
        </div>
      </section>

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

      <section className="card highlight-card action-card">
        <h2>Загрузить пробежку</h2>
        <p className="muted">
          Самый простой способ — загрузить GPX-файл на вкладке{' '}
          <Link to="/activities">Пробежки</Link> (кнопка «Загрузить трек» вверху страницы).
        </p>
      </section>

      <section className="card">
        <h2>Strava (опционально)</h2>
        <p className="muted">
          Можно подключить Strava для автоматической синхронизации вместо ручной загрузки файлов.
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
        <p className="muted small">
          Координаты меняются только при выборе новой точки на карте — кнопка «Обновить статистику» их не меняет.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => void handleRefreshProfile()}
            disabled={refreshing}
          >
            {refreshing ? 'Обновление...' : 'Обновить статистику'}
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => navigate('/onboarding')}
          >
            Изменить домашнюю базу
          </button>
        </div>
        {refreshMessage && <p className="info-box">{refreshMessage}</p>}
      </section>
    </div>
  );
}
