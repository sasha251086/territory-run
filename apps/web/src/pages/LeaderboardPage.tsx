import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { LeaderboardEntry, RivalFollow } from '../api/types';
import { useAuth } from '../context/AuthContext';

type Tab = 'cells' | 'influence' | 'distance';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('cells');
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
        const [leaderboard, followed] = await Promise.all([
          apiRequest<LeaderboardEntry[]>(`/leaderboard/${tab}?limit=50`),
          apiRequest<RivalFollow[]>('/rivals'),
        ]);
        if (!cancelled) {
          setItems(leaderboard);
          setRivals(followed);
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

  return (
    <div className="stack game-screen">
      <section className="screen-hero">
        <p className="eyebrow">Urban Conquest</p>
        <h1>Рейтинг районов</h1>
        <p>Сравните контроль зон, влияние и дистанцию с другими бегунами города.</p>
      </section>

      <section className="card compact-card">
        <h2>Рейтинг</h2>
        <div className="tabs">
          <button type="button" className={tab === 'cells' ? 'tab active' : 'tab'} onClick={() => setTab('cells')}>
            Клетки
          </button>
          <button type="button" className={tab === 'influence' ? 'tab active' : 'tab'} onClick={() => setTab('influence')}>
            Влияние
          </button>
          <button type="button" className={tab === 'distance' ? 'tab active' : 'tab'} onClick={() => setTab('distance')}>
            Дистанция
          </button>
        </div>
      </section>

      {message && (
        <section className="card">
          <p className="info-box">{message}</p>
        </section>
      )}

      <section className="card leaderboard-card">
        {loading ? (
          <p className="muted">Загрузка...</p>
        ) : items.length === 0 ? (
          <p className="muted">Пока нет данных.</p>
        ) : (
          <ol className="leaderboard">
            {items.map((item, index) => {
              const isMe = item.userId === user?.id;
              const isFollowed = followedIds.has(item.userId);
              return (
                <li key={item.userId} className={isMe ? 'is-you' : undefined}>
                  <span className="rank">{index + 1}</span>
                  <span className="name">{item.nickname}{isMe ? ' (вы)' : ''}</span>
                  <span className="value">{Math.round(item.value)}</span>
                  {!isMe && (
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
    </div>
  );
}
