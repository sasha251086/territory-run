import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type {
  LeaderboardEntry,
  RegionalLeaderboardEntry,
  RegionalLeaderboardResponse,
  RivalFollow,
  SeasonHistoryEntry,
  SeasonLeaderboardEntry,
  SeasonLeaderboardResponse,
} from '../api/types';
import { formatCellCount } from '../utils/territory';
import { useAuth } from '../context/AuthContext';

type Tab = 'cells' | 'influence' | 'distance' | 'nearby' | 'season';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('cells');
  const [items, setItems] = useState<LeaderboardEntry[]>([]);
  const [regional, setRegional] = useState<RegionalLeaderboardResponse | null>(null);
  const [season, setSeason] = useState<SeasonLeaderboardResponse | null>(null);
  const [seasonHistory, setSeasonHistory] = useState<SeasonHistoryEntry[]>([]);
  const [rivals, setRivals] = useState<RivalFollow[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const rivalsData = await apiRequest<RivalFollow[]>('/rivals');
        if (cancelled) return;
        setRivals(rivalsData);

        if (tab === 'nearby') {
          const regionalData = await apiRequest<RegionalLeaderboardResponse>(
            '/leaderboard/regional',
          );
          if (!cancelled) {
            setRegional(regionalData);
            setSeason(null);
            setItems([]);
          }
        } else if (tab === 'season') {
          const [seasonData, historyData] = await Promise.all([
            apiRequest<SeasonLeaderboardResponse>('/leaderboard/season?limit=50'),
            apiRequest<SeasonHistoryEntry[]>('/leaderboard/season/history'),
          ]);
          if (!cancelled) {
            setSeason(seasonData);
            setSeasonHistory(historyData);
            setRegional(null);
            setItems([]);
          }
        } else {
          const leaderboard = await apiRequest<LeaderboardEntry[]>(
            `/leaderboard/${tab}?limit=50`,
          );
          if (!cancelled) {
            setItems(leaderboard);
            setRegional(null);
            setSeason(null);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const followedIds = new Set(rivals.map((r) => r.userId));
  const displayItems: Array<LeaderboardEntry | RegionalLeaderboardEntry | SeasonLeaderboardEntry> =
    tab === 'nearby'
      ? (regional?.items ?? [])
      : tab === 'season'
        ? (season?.items ?? [])
        : items;

  async function toggleFollow(entry: LeaderboardEntry) {
    if (entry.userId === user?.id) {
      return;
    }

    setFollowLoading(entry.userId);
    setMessage(null);
    try {
      if (followedIds.has(entry.userId)) {
        await apiRequest(`/rivals/${entry.userId}`, { method: 'DELETE' });
        setRivals((prev) => prev.filter((r) => r.userId !== entry.userId));
      } else {
        await apiRequest(`/rivals/${entry.userId}`, { method: 'POST' });
        setRivals((prev) => [
          ...prev,
          {
            userId: entry.userId,
            nickname: entry.nickname,
            followedAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось изменить подписку');
    } finally {
      setFollowLoading(null);
    }
  }

  function valueLabel(value: number) {
    if (tab === 'cells' || tab === 'nearby') {
      return formatCellCount(value);
    }
    if (tab === 'season') {
      return `${value} захватов`;
    }
    if (tab === 'influence') return `${Math.round(value)} влияния`;
    return `${(value / 1000).toFixed(1)} км`;
  }

  const heroText =
    tab === 'nearby'
      ? 'Игроки в радиусе 5 км от вашей домашней базы — сравните контроль территории с соседями.'
      : tab === 'season'
        ? 'Сезонный рейтинг: новые захваты и влияние за текущий 45-дневный цикл. Территория на карте не сбрасывается.'
        : 'Сравните контроль зон, влияние и дистанцию с другими бегунами города.';

  return (
    <div className="page-screen">
      <h1 className="page-title">Рейтинг</h1>

      <div className="leaderboard-tabs">
        <button type="button" className={tab === 'cells' ? 'tab active' : 'tab'} onClick={() => setTab('cells')}>
          Клетки
        </button>
        <button type="button" className={tab === 'influence' ? 'tab active' : 'tab'} onClick={() => setTab('influence')}>
          Влияние
        </button>
        <button type="button" className={tab === 'distance' ? 'tab active' : 'tab'} onClick={() => setTab('distance')}>
          Дистанция
        </button>
        <button type="button" className={tab === 'nearby' ? 'tab active' : 'tab'} onClick={() => setTab('nearby')}>
          Рядом
        </button>
        <button type="button" className={tab === 'season' ? 'tab active' : 'tab'} onClick={() => setTab('season')}>
          Сезон
        </button>
      </div>

      <p className="muted small">{heroText}</p>

      {message && <p className="error-banner">{message}</p>}

      {tab === 'season' && season?.season && (
        <p className="info-box">
          Сезон {season.season.number} · осталось {season.season.daysLeft}{' '}
          {season.season.daysLeft === 1 ? 'день' : season.season.daysLeft < 5 ? 'дня' : 'дней'}
        </p>
      )}

      {tab === 'nearby' && regional?.noHomeBase && (
        <div>
          <p className="info-box">
            Установите домашнюю базу в{' '}
            <Link to="/profile">профиле</Link>, чтобы видеть соседей в радиусе 5 км.
          </p>
          <Link to="/onboarding" className="primary-btn" style={{ display: 'inline-block', marginTop: 8 }}>
            Выбрать базу
          </Link>
        </div>
      )}

      {tab === 'nearby' && regional && !regional.noHomeBase && regional.items.length < 3 && (
        <p className="muted">Пока мало игроков рядом.</p>
      )}

      <section>
        {loading ? (
          <p className="muted">Загрузка...</p>
        ) : tab === 'nearby' && regional?.noHomeBase ? (
          <p className="muted">Нужна домашняя база для регионального рейтинга.</p>
        ) : displayItems.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__icon" aria-hidden="true">🏆</p>
            <h3>{tab === 'season' ? 'Сезон только начался' : 'Рейтинг пуст'}</h3>
            <p className="muted">
              {tab === 'season'
                ? 'Загрузите пробежку, чтобы попасть в сезонный зачёт.'
                : 'Станьте первым — загрузите пробежку и захватите клетки на карте.'}
            </p>
          </div>
        ) : (
          <ol className="leaderboard">
            {displayItems.map((item, index) => {
              const isMe = item.userId === user?.id;
              const isFollowed = followedIds.has(item.userId);
              const rank = item.rank ?? index + 1;
              const distanceKm =
                tab === 'nearby' ? (item as RegionalLeaderboardEntry).distanceKm : null;
              const seasonInfluence =
                tab === 'season' ? (item as SeasonLeaderboardEntry).seasonInfluence : null;

              return (
                <li key={item.userId} className={isMe ? 'is-you' : undefined}>
                  <span className="rank">{rank}</span>
                  <span className="name">
                    {item.nickname}
                    {isMe ? ' (вы)' : ''}
                  </span>
                  <span className="value">
                    {valueLabel(Math.round(item.value))}
                    {distanceKm != null && (
                      <span className="muted small" style={{ display: 'block' }}>
                        {distanceKm.toFixed(1)} км
                      </span>
                    )}
                    {seasonInfluence != null && (
                      <span className="muted small" style={{ display: 'block' }}>
                        +{seasonInfluence} влияния
                      </span>
                    )}
                  </span>
                  {!isMe && tab !== 'season' && (
                    <button
                      type="button"
                      className={`ghost-btn small-btn follow-btn ${isFollowed ? 'is-followed' : ''}`}
                      onClick={() => void toggleFollow(item)}
                      disabled={followLoading === item.userId}
                    >
                      {followLoading === item.userId
                        ? '...'
                        : isFollowed
                          ? 'Следите'
                          : 'Следить'}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {tab === 'season' && seasonHistory.length > 0 && (
        <section className="profile-section">
          <h2>Ваши прошлые сезоны</h2>
          <ul className="list">
            {seasonHistory.map((entry) => (
              <li key={`${entry.seasonNumber}-${entry.rank}`} className="list-item">
                <strong>Сезон {entry.seasonNumber}</strong>
                <span>
                  #{entry.rank} · {entry.cellsOwned} захватов · {Math.round(entry.totalInfluence)} влияния
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
