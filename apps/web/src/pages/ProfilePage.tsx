import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { IntegrationInfo, MapSummary, RivalFollow } from '../api/types';
import { useAuth } from '../context/AuthContext';

function streakBonusLabel(streak: number) {
  if (streak >= 14) return '×1.3';
  if (streak >= 7) return '×1.2';
  if (streak >= 4) return '×1.1';
  return '×1.0';
}

function nextStreakHint(streak: number) {
  if (streak < 4) return 'До ×1.1 — ещё 4 дня подряд';
  if (streak < 7) return 'До ×1.2 — завтра (+7 дней)';
  if (streak < 14) return 'До ×1.3 — ещё активности';
  return 'Максимальный бонус';
}

const RIVAL_COLORS = ['#ff5a4a', '#9b6dff', '#ff9f43'];

export default function ProfilePage() {
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [rivals, setRivals] = useState<RivalFollow[]>([]);
  const [summary, setSummary] = useState<MapSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [integrationsData, rivalsData, summaryData] = await Promise.all([
        apiRequest<IntegrationInfo[]>('/integrations'),
        apiRequest<RivalFollow[]>('/rivals'),
        apiRequest<MapSummary>('/map/summary').catch(() => null),
      ]);
      setIntegrations(integrationsData);
      setRivals(rivalsData);
      setSummary(summaryData);
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

  const stravaConnected = integrations.some((item) => item.provider === 'strava' && item.connected);
  const currentStreak = user?.stats?.currentStreak ?? 0;
  const cellsOwned = user?.stats?.cellsOwned ?? 0;
  const totalInfluence = Math.round(user?.stats?.totalInfluence ?? 0);
  const totalRuns = user?.stats?.totalRuns ?? 0;
  const totalKm = Math.round(Number(user?.stats?.totalDistance ?? 0) / 1000);
  const level = Math.max(1, Math.floor(cellsOwned / 12) + 1);
  const weeklyGained = summary?.cellsGainedThisWeek ?? 0;
  const weeklyGoal = 15;
  const weeklyPct = Math.min(100, Math.round((weeklyGained / weeklyGoal) * 100));

  return (
    <div className="tr-screen">
      <section className="tr-profile-header tr-glass">
        <div className="tr-profile-header__avatar" aria-hidden="true" />
        <div style={{ flex: 1 }}>
          <h1 className="tr-profile-header__name">{user?.nickname}</h1>
          <p className="tr-profile-header__sub">
            Уровень {level} · Рига
          </p>
        </div>
        <button type="button" className="tr-btn tr-btn-secondary" style={{ height: 34, padding: '0 12px', fontSize: 11 }}>
          Изменить
        </button>
      </section>

      {currentStreak > 0 && (
        <section className="tr-streak-card tr-glass">
          <div className="tr-streak-card__head">
            <span>Стрик · Бонус {streakBonusLabel(currentStreak)}</span>
          </div>
          <div className="tr-streak-card__value">
            <strong>{currentStreak}</strong>
            <span>дней</span>
          </div>
          <div className="tr-progress" style={{ marginTop: 10 }}>
            <div
              className="tr-progress__fill tr-progress__fill--orange"
              style={{ width: `${Math.min(100, (currentStreak / 14) * 100)}%` }}
            />
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            {nextStreakHint(currentStreak)}
          </p>
        </section>
      )}

      <div className="tr-stats-row">
        <div className="tr-stat-block">
          <strong className="accent">{cellsOwned}</strong>
          <span>Клетки</span>
        </div>
        <div className="tr-stat-block">
          <strong>{totalInfluence}</strong>
          <span>Влияние</span>
        </div>
        <div className="tr-stat-block">
          <strong>{totalKm}</strong>
          <span>Дистанция</span>
        </div>
        <div className="tr-stat-block">
          <strong>{totalRuns}</strong>
          <span>Пробежек</span>
        </div>
      </div>

      <section className="tr-goal-card tr-glass">
        <div className="tr-goal-card__head">
          <span>Цель недели</span>
          <strong>
            {weeklyGained} / {weeklyGoal}
          </strong>
        </div>
        <div className="tr-progress">
          <div className="tr-progress__fill" style={{ width: `${weeklyPct}%` }} />
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          Осталось {Math.max(0, weeklyGoal - weeklyGained)} клеток до воскресенья
        </p>
      </section>

      <button
        type="button"
        className="tr-btn tr-btn-secondary"
        style={{ width: '100%' }}
        onClick={() => navigate('/onboarding')}
      >
        Сменить базу
      </button>

      <section className="tr-glass" style={{ padding: 14 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 13 }}>Соперники ({rivals.length} / 3)</h2>
        <div className="tr-rivals-row">
          {rivals.map((rival, index) => (
            <span key={rival.userId} className="tr-rival-chip">
              <span
                className="tr-rival-chip__dot"
                style={{ background: RIVAL_COLORS[index % RIVAL_COLORS.length] }}
              />
              {rival.nickname}
              <button
                type="button"
                className="tr-rival-chip__remove"
                onClick={() => void unfollowRival(rival.userId)}
                aria-label={`Удалить ${rival.nickname}`}
              >
                ×
              </button>
            </span>
          ))}
          {rivals.length < 3 && (
            <Link to="/leaderboard" className="tr-rival-add" aria-label="Добавить соперника">
              +
            </Link>
          )}
        </div>
      </section>

      {!stravaConnected && (
        <section className="tr-glass" style={{ padding: 14 }}>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            Подключите Strava для автосинхронизации пробежек
          </p>
          <button type="button" className="tr-btn-strava" onClick={() => void connectStrava()} disabled={loading}>
            Подключить Strava
          </button>
        </section>
      )}

      {message && <p className="error-banner">{message}</p>}

      <button type="button" className="tr-btn tr-btn-ghost" onClick={() => void refreshProfile()}>
        Обновить статистику
      </button>

      <button type="button" className="tr-btn tr-btn-ghost" onClick={() => logout()}>
        Выйти
      </button>
    </div>
  );
}
