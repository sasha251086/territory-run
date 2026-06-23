import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { apiRequest } from '../api/client';
import type { LeaderboardEntry } from '../api/types';
import { formatCellsArea } from '../utils/territory';
import { useAuth } from '../context/AuthContext';

const RANK_COLORS = ['#3dff8a', '#45c8e7', '#9b6dff', '#f5c842'];

export default function MapMiniLeaderboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<LeaderboardEntry[]>('/leaderboard/cells?limit=4')
      .then((data) => {
        if (!cancelled) {
          setItems(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="map-hud map-leaderboard-panel" aria-label="Мини-рейтинг">
      <p className="map-panel-label">Топ района</p>
      <ol>
        {items.map((item, index) => {
          const isYou = item.userId === user?.id;
          return (
            <li
              key={item.userId}
              className={isYou ? 'is-you' : undefined}
              style={{ '--rank-color': RANK_COLORS[index] ?? '#94a3b8' } as CSSProperties}
            >
              <span>{index + 1}</span>
              <em>{item.nickname}{isYou ? ' (вы)' : ''}</em>
              <strong>{formatCellsArea(Math.round(item.value))}</strong>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
