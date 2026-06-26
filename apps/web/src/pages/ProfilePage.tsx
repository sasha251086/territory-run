import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { IntegrationInfo, RivalFollow } from '../api/types';
import { useAuth } from '../context/AuthContext';
import {
  readSiegeNotificationsEnabled,
  requestSiegeNotifications,
  writeSiegeNotificationsEnabled,
} from '../hooks/useSiegeNotifications';
import {
  enableSamsungAutoSync,
  readSamsungAutoSyncEnabled,
  writeSamsungAutoSyncEnabled,
} from '../hooks/useSamsungAutoSync';
import { healthSync } from '../services/health-sync.service';
import {
  canActivateFreeze,
  daysUntilFreezeAvailable,
  daysUntilFreezeEnds,
} from '../utils/freeze';

import {
  softCapLabel,
  streakBonusLabel,
  MAX_INFLUENCE_GAIN_MULTIPLIER,
  SOFT_CAP_CELLS,
  DECAY_DELETE_AFTER_DAYS,
} from '../constants/game';

export default function ProfilePage() {
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [rivals, setRivals] = useState<RivalFollow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [freezeMessage, setFreezeMessage] = useState<string | null>(null);
  const [uiOrigin, setUiOrigin] = useState('');

  useEffect(() => {
    setUiOrigin(window.location.origin);
  }, []);

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

  async function handleActivateFreeze() {
    setFreezeLoading(true);
    setFreezeMessage(null);
    try {
      await apiRequest('/users/me/freeze', { method: 'POST' });
      await refreshProfile();
      setFreezeMessage('Территория заморожена на 7 дней');
    } catch (err) {
      setFreezeMessage(err instanceof Error ? err.message : 'Не удалось активировать заморозку');
    } finally {
      setFreezeLoading(false);
    }
  }

  async function handleCancelFreeze() {
    setFreezeLoading(true);
    setFreezeMessage(null);
    try {
      await apiRequest('/users/me/freeze', { method: 'DELETE' });
      await refreshProfile();
      setFreezeMessage('Заморозка отменена');
    } catch (err) {
      setFreezeMessage(err instanceof Error ? err.message : 'Не удалось отменить заморозку');
    } finally {
      setFreezeLoading(false);
    }
  }

  const freezeActive = user?.freezeActive ?? false;
  const freezeDaysLeft =
    freezeActive && user?.freezeActivatedAt
      ? daysUntilFreezeEnds(user.freezeActivatedAt)
      : null;
  const freezeCooldownDays =
    !freezeActive && user?.freezeLastUsedAt && !canActivateFreeze(freezeActive, user.freezeLastUsedAt)
      ? daysUntilFreezeAvailable(user.freezeLastUsedAt)
      : null;
  const showActivateFreeze = canActivateFreeze(freezeActive, user?.freezeLastUsedAt);
  const [siegeNotifyEnabled, setSiegeNotifyEnabled] = useState(readSiegeNotificationsEnabled);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
  const [samsungAutoSync, setSamsungAutoSync] = useState(readSamsungAutoSyncEnabled);
  const [samsungAutoSyncMessage, setSamsungAutoSyncMessage] = useState<string | null>(null);
  const [showSamsungSettings, setShowSamsungSettings] = useState(false);

  useEffect(() => {
    async function detectNativeHealth() {
      if (!healthSync.isNativeApp() || !healthSync.isAndroid()) {
        setShowSamsungSettings(false);
        return;
      }
      setShowSamsungSettings(true);
    }
    void detectNativeHealth();
  }, []);

  async function toggleSamsungAutoSync() {
    setSamsungAutoSyncMessage(null);
    if (samsungAutoSync) {
      writeSamsungAutoSyncEnabled(false);
      setSamsungAutoSync(false);
      setSamsungAutoSyncMessage('Автозагрузка отключена');
      return;
    }
    const ok = await enableSamsungAutoSync();
    setSamsungAutoSync(ok);
    if (ok) {
      setSamsungAutoSyncMessage(
        'Автозагрузка включена. Новые пробежки из Samsung Health подтянутся при открытии приложения (раз в ~30 мин).',
      );
    } else {
      setSamsungAutoSyncMessage(
        'Разрешите доступ к Samsung Health в системном диалоге (Developer Mode в Samsung Health, если SDK ещё не в Play).',
      );
    }
  }

  async function toggleSiegeNotifications() {
    setNotifyMessage(null);
    if (siegeNotifyEnabled) {
      writeSiegeNotificationsEnabled(false);
      setSiegeNotifyEnabled(false);
      setNotifyMessage('Уведомления отключены');
      return;
    }
    const ok = await requestSiegeNotifications();
    setSiegeNotifyEnabled(ok);
    if (!ok) {
      setNotifyMessage('Разрешите уведомления в настройках браузера');
    } else {
      setNotifyMessage('Уведомления об осадах включены');
    }
  }

  const notifySupported = typeof Notification !== 'undefined';

  return (
    <div className="page-screen">
      <header className="profile-header">
        <div className="wire-avatar" aria-hidden="true" />
        <div>
          <h1>{user?.nickname}</h1>
          <p>{user?.email}</p>
        </div>
        <span className="wire-chip">{softCapLabel(user?.stats?.cellsOwned ?? 0)}</span>
      </header>

      <div className="stats-grid">
        <div>
          <span>Клетки</span>
          <strong>{user?.stats?.cellsOwned ?? 0}</strong>
        </div>
        <div>
          <span>Влияние</span>
          <strong>{Math.round(user?.stats?.totalInfluence ?? 0)}</strong>
        </div>
        <div>
          <span>Пробежки</span>
          <strong>{user?.stats?.totalRuns ?? 0}</strong>
        </div>
        <div>
          <span>Стрик</span>
          <strong>
            {currentStreak > 0 ? `${currentStreak} дн · ${streakBonusLabel(currentStreak)}` : '—'}
          </strong>
        </div>
      </div>

      {currentStreak > 0 && streakBonus && (
        <p className="muted small">Бонус стрика: {streakBonus}</p>
      )}

      <section className="profile-section profile-mechanics">
        <h2>Игровые правила</h2>
        <ul className="game-mechanics-list">
          <li>Домашняя зона: бонус ×1.25 к влиянию в радиусе 350 м от базы.</li>
          <li>
            Soft cap: после {SOFT_CAP_CELLS} клеток прирост влияния ×0.5 —{' '}
            {softCapLabel(user?.stats?.cellsOwned ?? 0)}.
          </li>
          <li>Потолок множителей за пробежку в клетке: ×{MAX_INFLUENCE_GAIN_MULTIPLIER}.</li>
          <li>Затухание: −2% в день, обнуление через {DECAY_DELETE_AFTER_DAYS} дней без бега.</li>
          <li>На карте — миссии и «Цели»: защита, добивание, захват, расширение.</li>
        </ul>
      </section>

      <section className="profile-section">
        <h2>Уведомления</h2>
        {notifySupported ? (
          <>
            <div className="profile-notify-row">
              <p className="muted">Осады ваших клеток (проверка раз в минуту)</p>
              <button
                type="button"
                className={siegeNotifyEnabled ? 'primary-btn small-btn' : 'ghost-btn small-btn'}
                onClick={() => void toggleSiegeNotifications()}
              >
                {siegeNotifyEnabled ? 'Вкл' : 'Выкл'}
              </button>
            </div>
            {notifyMessage && <p className="info-box">{notifyMessage}</p>}
          </>
        ) : (
          <p className="muted small">Браузер не поддерживает push-уведомления.</p>
        )}
      </section>

      {showSamsungSettings && (
        <section className="profile-section">
          <h2>Samsung Health</h2>
          <p className="muted small">
            На Samsung с APK импорт идёт через Samsung Health Data SDK (GPS-маршруты). Ручная синхронизация — на
            вкладке <Link to="/activities">Пробежки</Link>.
          </p>
          <label className="profile-notify-row" style={{ cursor: 'pointer' }}>
            <span>Автоматически загружать новые пробежки</span>
            <input
              type="checkbox"
              checked={samsungAutoSync}
              onChange={() => void toggleSamsungAutoSync()}
              aria-label="Автоматически загружать пробежки из Samsung Health"
            />
          </label>
          {samsungAutoSyncMessage && <p className="info-box">{samsungAutoSyncMessage}</p>}
        </section>
      )}

      <section className="profile-section">
        <h2>Защита территории</h2>
        {freezeActive && freezeDaysLeft != null ? (
          <>
            <p className="info-box">
              Заморозка активна · осталось {freezeDaysLeft}{' '}
              {freezeDaysLeft === 1 ? 'день' : freezeDaysLeft < 5 ? 'дня' : 'дней'}
            </p>
            <p className="muted small">
              Клетки не удаляются, пока заморозка активна. Влияние по-прежнему медленно угасает.
            </p>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => void handleCancelFreeze()}
              disabled={freezeLoading}
            >
              {freezeLoading ? '…' : 'Отменить заморозку'}
            </button>
          </>
        ) : showActivateFreeze ? (
          <>
            <p className="muted">
              Клетки не будут удаляться, пока вы в отпуске или на больничном. Доступно раз в 90 дней.
            </p>
            <button
              type="button"
              className="primary-btn"
              onClick={() => void handleActivateFreeze()}
              disabled={freezeLoading}
            >
              {freezeLoading ? '…' : 'Заморозить на 7 дней'}
            </button>
            <p className="muted small">Клетки не удаляются 7 дней. Доступно раз в 90 дней.</p>
          </>
        ) : freezeCooldownDays != null ? (
          <p className="muted">
            Следующая заморозка доступна через {freezeCooldownDays}{' '}
            {freezeCooldownDays === 1 ? 'день' : freezeCooldownDays < 5 ? 'дня' : 'дней'}
          </p>
        ) : null}
        {freezeMessage && <p className="info-box">{freezeMessage}</p>}
      </section>

      <section className="profile-section">
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

      <section className="profile-section">
        <h2>Загрузить пробежку</h2>
        <p className="muted">
          Самый простой способ — загрузить GPX-файл на вкладке{' '}
          <Link to="/activities">Пробежки</Link> (кнопка «Загрузить трек» вверху страницы).
        </p>
      </section>

      <section className="profile-section">
        <h2>Strava</h2>
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

      <section className="profile-section">
        <h2>Домашняя база</h2>
        <p className="muted">
          {user?.homeLat != null && user.homeLng != null
            ? user.homeAreaLabel
              ? `База: ${user.homeAreaLabel} (${user.homeLat.toFixed(5)}, ${user.homeLng.toFixed(5)})`
              : `Координаты: ${user.homeLat.toFixed(5)}, ${user.homeLng.toFixed(5)}`
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
        {refreshMessage && (
          <p className={refreshMessage === 'Статистика обновлена' ? 'info-box' : 'error-banner'}>
            {refreshMessage}
          </p>
        )}
      </section>

      <section className="profile-section">
        <h2>Аккаунт</h2>
        <p className="muted small">Выход из аккаунта на этом устройстве.</p>
        <button type="button" className="ghost-btn" onClick={() => void logout()}>
          Выйти
        </button>
        <p className="muted small" style={{ marginTop: 12 }}>
          Сборка интерфейса: {__APP_BUILD__}
          <br />
          Источник UI: {uiOrigin || '…'}
          {uiOrigin && uiOrigin !== 'https://localhost' && (
            <>
              <br />
              <strong>Внимание:</strong> приложение грузит UI с сайта, не из APK.
            </>
          )}
        </p>
      </section>
    </div>
  );
}
