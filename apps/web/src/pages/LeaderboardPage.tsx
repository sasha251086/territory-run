import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client';
import type { LeaderboardEntry, RivalFollow } from '../api/types';
import { useAuth } from '../context/AuthContext';

type Tab = 'city' | 'rivals' | 'total';

const PODIUM_ORDER = [1, 0, 2] as const;

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('city');
  const [items, setItems] = useState<LeaderboardEntry[]>([]);
  const [rivals, setRivals] = useState<RivalFollow[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const apiTab = tab === 'total' ? 'influence' : 'cells';
        const [leaderboard, followed] = await Promise.all([
          apiRequest<LeaderboardEntry[]>(`/leaderboard/${apiTab}?limit=50`),
          apiRequest<RivalFollow[]>('/rivals'),
        ]);
        if (!cancelled) {
          setItems(leaderboard);
          setRivals(followed);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const followedIds = useMemo(() => new Set(rivals.map((r) => r.userId)), [rivals]);

  const displayItems = useMemo(() => {
    if (tab !== 'rivals' || !user) return items;
    const ids = new Set([user.id, ...rivals.map((r) => r.userId)]);
    return items.filter((item) => ids.has(item.userId));
  }, [items, tab, user, rivals]);

  async function toggleFollow(entry: LeaderboardEntry) {
    if (entry.userId === user?.id) return;

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
          { userId: entry.userId, nickname: entry.nickname, followedAt: new Date().toISOString() },
        ]);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось изменить подписку');
    } finally {
      setFollowLoading(null);
    }
  }

  function valueLabel(value: number) {
    if (tab === 'total') return `${Math.round(value)}`;
    return `${Math.round(value)} кл`;
  }

  const top3 = displayItems.slice(0, 3);
  const rest = displayItems.slice(3);

  return (
    <div className="tr-screen">
      <div className="tr-segmented" role="tablist">
        {(
          [
            ['city', 'Город'],
            ['rivals', 'Я+соперники'],
            ['total', 'Всего'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            className={`tr-segmented__btn${tab === key ? ' tr-segmented__btn--active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p className="info-box">{message}</p>}

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : displayItems.length === 0 ? (
        <p className="muted">Пока нет данных.</p>
      ) : (
        <>
          {top3.length > 0 && (
            <div className="tr-leaderboard-podium" aria-label="Топ-3">
              {PODIUM_ORDER.map((slot) => {
                const entry = top3[slot];
                const rank = slot + 1;
                if (!entry) {
                  return <div key={`empty-${slot}`} className="tr-podium-block" />;
                }
                return (
                  <div key={entry.userId} className={`tr-podium-block tr-podium-block--${rank}`}>
                    <span className="tr-podium-block__rank">#{rank}</span>
                    <span className="tr-podium-block__name">{entry.nickname}</span>
                    <span className="tr-podium-block__value">{valueLabel(entry.value)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <ol style={{ display: 'grid', gap: 8, margin: 0, padding: 0 }}>
            {rest.map((item, index) => {
              const isMe = item.userId === user?.id;
              const isFollowed = followedIds.has(item.userId);
              return (
                <li key={item.userId} className={`tr-leaderboard-row${isMe ? ' is-you' : ''}`}>
                  <span className="tr-leaderboard-row__rank">#{index + 4}</span>
                  <span className="tr-leaderboard-row__avatar" aria-hidden="true" />
                  <span className="tr-leaderboard-row__name">
                    {item.nickname}
                    {isMe ? ' · вы' : ''}
                  </span>
                  <span className="tr-leaderboard-row__value">{valueLabel(item.value)}</span>
                  {!isMe && (
                    <button
                      type="button"
                      className={`tr-btn-follow${isFollowed ? ' is-followed' : ''}`}
                      onClick={() => void toggleFollow(item)}
                      disabled={followLoading === item.userId}
                    >
                      {followLoading === item.userId ? '…' : isFollowed ? 'Следите' : 'Следить'}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
