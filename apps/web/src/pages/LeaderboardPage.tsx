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
import { DECAY_DELETE_AFTER_DAYS, SEASON_DURATION_DAYS, displayInfluence } from '../constants/game';
import { LEADERBOARD_PAGE_SIZE } from '../constants/pagination';
import { formatCellCount } from '../utils/territory';
import { shareAppInvite } from '../utils/share-invite';
import { hasSeenHint, markHintSeen } from '../utils/first-time-hint';
import { useAuth } from '../context/AuthContext';
import LeaderboardPodium from '../components/LeaderboardPodium';
import SkeletonList from '../components/SkeletonList';

type Metric = 'cells' | 'influence' | 'distance';
type Scope = 'nearby' | 'city' | 'season';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [metric, setMetric] = useState<Metric>('cells');
  const [scope, setScope] = useState<Scope>('nearby');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [items, setItems] = useState<LeaderboardEntry[]>([]);
  const [regional, setRegional] = useState<RegionalLeaderboardResponse | null>(null);
  const [season, setSeason] = useState<SeasonLeaderboardResponse | null>(null);
  const [seasonHistory, setSeasonHistory] = useState<SeasonHistoryEntry[]>([]);
  const [rivals, setRivals] = useState<RivalFollow[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    if (!scopeInitialized && user) {
      setScope(user.homeLat != null && user.homeLng != null ? 'nearby' : 'city');
      setScopeInitialized(true);
    }
  }, [user, scopeInitialized]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const rivalsData = await apiRequest<RivalFollow[]>('/rivals');
        if (cancelled) return;
        setRivals(rivalsData);

        if (scope === 'nearby') {
          const regionalData = await apiRequest<RegionalLeaderboardResponse>(
            `/leaderboard/regional?metric=${metric}`,
          );
          if (!cancelled) {
            setRegional(regionalData);
            setSeason(null);
            setItems([]);
          }
        } else if (scope === 'season') {
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
            `/leaderboard/${metric}?limit=${LEADERBOARD_PAGE_SIZE}`,
          );
          if (!cancelled) {
            setItems(leaderboard);
            setRegional(null);
            setSeason(null);
            const me = leaderboard.find((item) => item.userId === user?.id) ?? null;
            setMyEntry(me);
            if (!me && user) {
              const myData = await apiRequest<{
                rank: number;
                value: number;
                nickname: string;
                cellsOwned: number;
              } | null>(`/leaderboard/${metric}/me`).catch(() => null);
              if (myData && !cancelled) {
                setMyEntry({
                  userId: user.id,
                  nickname: myData.nickname,
                  value: myData.value,
                  rank: myData.rank,
                  avatarUrl: null,
                });
              }
            }
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
  }, [metric, scope, user?.id]);

  const followedIds = new Set(rivals.map((r) => r.userId));
  const displayItems: Array<LeaderboardEntry | RegionalLeaderboardEntry | SeasonLeaderboardEntry> =
    scope === 'nearby'
      ? (regional?.items ?? [])
      : scope === 'season'
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
        markHintSeen('rival-follow-hint');
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
    if (scope === 'season') {
      return `${value} захватов`;
    }
    if (metric === 'cells') {
      return formatCellCount(value);
    }
    if (metric === 'influence') {
      return `${displayInfluence(value)} влияния`;
    }
    return `${(value / 1000).toFixed(1)} км`;
  }

  function leaderGapLabel(): string | null {
    if (displayItems.length < 2 || !user) {
      return null;
    }
    const leader = displayItems[0];
    const runnerUp = displayItems[1];
    if (leader.userId !== user.id) {
      return null;
    }
    const gap = Math.round(leader.value - runnerUp.value);
    if (gap <= 0) {
      return null;
    }
    if (metric === 'cells' || scope === 'season') {
      return `+${formatCellCount(gap)} впереди`;
    }
    if (metric === 'influence') {
      return `+${displayInfluence(gap)} влияния впереди`;
    }
    return `+${(gap / 1000).toFixed(1)} км впереди`;
  }

  const leaderGap = leaderGapLabel();
  const podiumItems = displayItems.slice(0, 3).map((item) => ({
    userId: item.userId,
    nickname: item.nickname,
    value: item.value,
  }));
  const showPodium =
    !loading && scope !== 'nearby' && displayItems.length >= 3;
  const listItems = showPodium ? displayItems.slice(3) : displayItems;
  const soloInLeaderboard =
    !loading &&
    displayItems.length === 1 &&
    displayItems[0]?.userId === user?.id &&
    (scope === 'city' || scope === 'season');
  const emptyLeaderboard = !loading && displayItems.length === 0 && scope !== 'nearby';

  async function handleShareInvite() {
    setInviteMessage(null);
    const result = await shareAppInvite();
    if (result === 'shared') {
      setInviteMessage('Приглашение отправлено');
    } else if (result === 'copied') {
      setInviteMessage('Ссылка скопирована — отправьте друзьям');
    } else {
      setInviteMessage('Не удалось поделиться');
    }
  }

  const heroText =
    scope === 'nearby'
      ? `Игроки в радиусе 5 км от домашней базы — сравните ${
          metric === 'cells' ? 'контроль территории' : metric === 'influence' ? 'влияние' : 'дистанцию'
        } с соседями.`
      : scope === 'season'
        ? `Сезонный рейтинг: новые захваты за ${SEASON_DURATION_DAYS} дней. Территория не сбрасывается (след в клетке исчезает через ${DECAY_DELETE_AFTER_DAYS} дн. без пробежки через неё).`
        : 'Сравните контроль зон, влияние и дистанцию с другими бегунами города.';

  return (
    <div className="page-screen">
      <h1 className="page-title">Рейтинг</h1>

      {scope !== 'season' && (
        <div className="segmented segmented--3">
          <button
            type="button"
            className={metric === 'cells' ? 'active' : undefined}
            onClick={() => setMetric('cells')}
          >
            Клетки
          </button>
          <button
            type="button"
            className={metric === 'influence' ? 'active' : undefined}
            onClick={() => setMetric('influence')}
          >
            Влияние
          </button>
          <button
            type="button"
            className={metric === 'distance' ? 'active' : undefined}
            onClick={() => setMetric('distance')}
          >
            Дистанция
          </button>
        </div>
      )}

      <div className="segmented segmented--3">
        <button
          type="button"
          className={scope === 'nearby' ? 'active' : undefined}
          onClick={() => setScope('nearby')}
        >
          Рядом
        </button>
        <button
          type="button"
          className={scope === 'city' ? 'active' : undefined}
          onClick={() => setScope('city')}
        >
          Город
        </button>
        <button
          type="button"
          className={scope === 'season' ? 'active' : undefined}
          onClick={() => setScope('season')}
        >
          Сезон
        </button>
      </div>

      <p className="muted small">{heroText}</p>

      {message && <p className="error-banner">{message}</p>}

      {scope === 'season' && season?.season && (() => {
        const total = SEASON_DURATION_DAYS;
        const left = season.season.daysLeft;
        const pct = Math.round(((total - left) / total) * 100);
        return (
          <div className="season-progress">
            <div className="season-progress__header">
              <span>Сезон {season.season.number}</span>
              <span className="muted small">осталось {left} дн</span>
            </div>
            <div
              className="season-progress__bar"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="season-progress__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })()}

      {scope === 'nearby' && regional?.noHomeBase && (
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

      {scope === 'nearby' && regional && !regional.noHomeBase && regional.items.length === 1 && (
        <p className="muted">Пока только вы в радиусе 5 км — пригласите друзей.</p>
      )}

      {scope === 'nearby' && regional && !regional.noHomeBase && regional.items.length === 2 && (
        <p className="muted small">Мало игроков рядом — добавьте соперников из списка ниже.</p>
      )}

      {(soloInLeaderboard || emptyLeaderboard) && (
        <div className="empty-state">
          <p className="empty-state__icon" aria-hidden="true">👋</p>
          <h3>
            {scope === 'season'
              ? 'В сезоне пока только вы'
              : emptyLeaderboard
                ? 'В городе пока никого'
                : 'Пока только вы в городе'}
          </h3>
          <p className="muted">
            {scope === 'season'
              ? 'Загрузите пробежку — или пригласите друзей соревноваться в захватах.'
              : 'Пригласите друзей — вместе интереснее захватывать клетки.'}
          </p>
          <button type="button" className="primary-btn" onClick={() => void handleShareInvite()}>
            Поделиться
          </button>
          {inviteMessage && <p className="info-box">{inviteMessage}</p>}
        </div>
      )}

      {leaderGap && !showPodium && !soloInLeaderboard && !emptyLeaderboard && (
        <p className="info-box">{leaderGap}</p>
      )}

      {showPodium && (
        <LeaderboardPodium
          items={podiumItems}
          currentUserId={user?.id}
          valueLabel={valueLabel}
        />
      )}

      <section>
        {loading ? (
          <SkeletonList rows={6} />
        ) : scope === 'nearby' && regional?.noHomeBase ? (
          <p className="muted">Нужна домашняя база для регионального рейтинга.</p>
        ) : soloInLeaderboard || emptyLeaderboard ? null : listItems.length === 0 && showPodium ? (
          <p className="muted small">Остальные игроки появятся по мере роста базы.</p>
        ) : listItems.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__icon" aria-hidden="true">🏆</p>
            <h3>{scope === 'season' ? 'Сезон только начался' : 'Рейтинг пуст'}</h3>
            <p className="muted">
              {scope === 'season'
                ? 'Загрузите пробежку, чтобы попасть в сезонный зачёт.'
                : 'Станьте первым — загрузите пробежку и захватите клетки на карте.'}
            </p>
          </div>
        ) : (
          <ol className="leaderboard">
            {listItems.map((item, index) => {
              const isMe = item.userId === user?.id;
              const isFollowed = followedIds.has(item.userId);
              const rank = item.rank ?? (showPodium ? index + 4 : index + 1);
              const distanceKm =
                scope === 'nearby' ? (item as RegionalLeaderboardEntry).distanceKm : null;
              const seasonInfluence =
                scope === 'season' ? (item as SeasonLeaderboardEntry).seasonInfluence : null;
              const above = index > 0 ? listItems[index - 1] : null;
              const gap =
                isMe && above ? Math.round(above.value - item.value) : 0;
              const gapPct =
                isMe && above && above.value > 0
                  ? Math.min(100, Math.round((item.value / above.value) * 100))
                  : 0;

              return (
                <li key={item.userId} className={isMe ? 'is-you' : undefined}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                    <span className="rank">{rank}</span>
                    <span className="name">
                      {item.nickname}
                      {isMe ? ' (вы)' : ''}
                    </span>
                    <span className="value" style={{ marginLeft: 'auto' }}>
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
                    {!isMe && scope !== 'season' && (
                      <button
                        type="button"
                        className={`ghost-btn small-btn follow-btn ${isFollowed ? 'is-followed' : ''}`}
                        title="Клетки этого игрока подсветятся на карте"
                        onClick={() => void toggleFollow(item)}
                        disabled={followLoading === item.userId}
                      >
                        {followLoading === item.userId
                          ? '...'
                          : isFollowed
                            ? '✓ Слежу'
                            : '+ Следить'}
                      </button>
                    )}
                  </div>
                  {!hasSeenHint('rival-follow-hint') &&
                    index === 0 &&
                    !isMe &&
                    !isFollowed &&
                    scope !== 'season' && (
                      <p className="leaderboard-follow-hint muted small">
                        Клетки соперника появятся на карте
                      </p>
                    )}
                  {isMe && gap > 0 && above && (
                    <div className="leaderboard-gap">
                      <div className="leaderboard-gap__bar">
                        <div
                          className="leaderboard-gap__fill"
                          style={{ width: `${gapPct}%` }}
                        />
                      </div>
                      <span className="leaderboard-gap__label">
                        −{valueLabel(gap)} до #{above.rank ?? index}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {scope === 'city' &&
          myEntry &&
          !listItems.some((i) => i.userId === user?.id) &&
          !displayItems.some((i) => i.userId === user?.id) && (
            <div className="leaderboard-my-row">
              <span className="rank">#{myEntry.rank ?? '?'}</span>
              <span className="name">
                {myEntry.nickname} <em>(вы)</em>
              </span>
              <span className="value" style={{ marginLeft: 'auto' }}>
                {valueLabel(Math.round(myEntry.value))}
              </span>
            </div>
          )}
      </section>

      {scope === 'season' && seasonHistory.length > 0 && (
        <section className="profile-section">
          <h2>Ваши прошлые сезоны</h2>
          <ul className="list">
            {seasonHistory.map((entry) => (
              <li key={`${entry.seasonNumber}-${entry.rank}`} className="list-item">
                <strong>Сезон {entry.seasonNumber}</strong>
                <span>
                  #{entry.rank} · {entry.cellsOwned} захватов · {displayInfluence(entry.totalInfluence)} влияния
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
