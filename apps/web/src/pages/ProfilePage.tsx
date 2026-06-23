import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { IntegrationInfo, RivalFollow } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

function streakBonusLabel(streak: number) {
  if (streak >= 14) return '×1.3 к влиянию';
  if (streak >= 7) return '×1.2 к влиянию';
  if (streak >= 4) return '×1.1 к влиянию';
  return null;
}

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [rivals, setRivals] = useState<RivalFollow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [integrationsData, rivalsData] = await Promise.all([
        apiRequest<IntegrationInfo[]>('/integrations'),
        apiRequest<RivalFollow[]>('/rivals'),
      ]);
      setIntegrations(integrationsData);
      setRivals(rivalsData);
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

  async function unfollowRival(targetUserId: string) {
    try {
      await apiRequest(`/rivals/${targetUserId}`, { method: 'DELETE' });
      setRivals((prev) => prev.filter((r) => r.userId !== targetUserId));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось отписаться');
    }
  }

  const stravaConnected = integrations.some(
    (item) => item.provider === 'strava' && item.connected,
  );

  const { theme, toggleTheme } = useTheme();
  const currentStreak = user?.stats?.currentStreak ?? 0;
  const streakBonus = streakBonusLabel(currentStreak);

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
        {currentStreak > 0 && (
          <p className="streak-line">
            🔥 Стрик: {currentStreak} дн.
            {streakBonus ? ` · бонус ${streakBonus}` : ''}
          </p>
        )}
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
          {currentStreak > 0 && (
            <div><span>Стрик</span><strong>{currentStreak} дн.</strong></div>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Оформление</h2>
        <p className="muted">
          Тёмная тема «Neon Territory» по умолчанию. Переключите на светлую для дневного использования.
        </p>
        <button type="button" className="ghost-btn" onClick={toggleTheme}>
          {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        </button>
      </section>

      <section className="card">
        <h2>Соперники</h2>
        <p className="muted">
          До 3 соперников — их клетки подсвечиваются на карте. Добавьте из{' '}
          <Link to="/leaderboard">рейтинга</Link>.
        </p>
        {rivals.length === 0 ? (
          <p className="muted">Соперников пока нет.</p>
        ) : (
          <ul className="list">
            {rivals.map((rival) => (
              <li key={rival.userId} className="list-item">
                <strong>{rival.nickname}</strong>
                <button
                  type="button"
                  className="ghost-btn small-btn"
                  onClick={() => void unfollowRival(rival.userId)}
                >
                  Отписаться
                </button>
              </li>
            ))}
          </ul>
        )}
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
