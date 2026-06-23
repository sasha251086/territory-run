import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { LeaderboardEntry } from '../api/types';

type Tab = 'cells' | 'influence' | 'distance';

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('cells');
  const [items, setItems] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await apiRequest<LeaderboardEntry[]>(`/leaderboard/${tab}?limit=50`);
        if (!cancelled) {
          setItems(data);
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

      <section className="card leaderboard-card">
        {loading ? (
          <p className="muted">Загрузка...</p>
        ) : items.length === 0 ? (
          <p className="muted">Пока нет данных.</p>
        ) : (
          <ol className="leaderboard">
            {items.map((item, index) => (
              <li key={item.userId}>
                <span className="rank">{index + 1}</span>
                <span className="name">{item.nickname}</span>
                <span className="value">{Math.round(item.value)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
