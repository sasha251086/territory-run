import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { FeedEvent } from '../api/types';
import { formatFeedBadge, formatFeedEvent } from '../utils/feed-format';
import { useAuth } from '../context/AuthContext';

type FeedTab = 'all' | 'rivals';

function siegeMapLink(event: FeedEvent): string | null {
  if (event.type !== 'cell_siege') return null;
  const h3Index = event.payload.h3Index;
  if (typeof h3Index !== 'string' || !h3Index) return null;
  return `/?highlight=${encodeURIComponent(h3Index)}`;
}

export default function FeedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FeedTab>('all');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const query = tab === 'rivals' ? '?limit=30&rivals=true' : '?limit=30';
        const data = await apiRequest<{ items: FeedEvent[] }>(`/feed${query}`);
        if (!cancelled) {
          setItems(data.items);
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

  function openOnMap(event: FeedEvent) {
    const link = siegeMapLink(event);
    if (link) {
      navigate(link);
    }
  }

  return (
    <div className="page-screen">
      <h1 className="page-title">Лента</h1>

      <div className="segmented">
        <button
          type="button"
          className={tab === 'all' ? 'active' : undefined}
          onClick={() => setTab('all')}
        >
          Все
        </button>
        <button
          type="button"
          className={tab === 'rivals' ? 'active' : undefined}
          onClick={() => setTab('rivals')}
        >
          Соперники
        </button>
      </div>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h3>Пока тихо</h3>
          <p className="muted">
            {tab === 'rivals'
              ? 'Добавьте соперников в рейтинге, чтобы видеть их события.'
              : 'Здесь появятся события после первой пробежки.'}
          </p>
        </div>
      ) : (
        <ul className="feed-list">
          {items.map((event) => {
            const badge = formatFeedBadge(event);
            const mapLink = siegeMapLink(event);

            return (
              <li key={event.id} className="feed-row">
                <div className="feed-row__head">
                  <strong>{event.user.nickname}</strong>
                  {badge && <span className="wire-badge">{badge}</span>}
                </div>
                <p>{formatFeedEvent(event, user?.id)}</p>
                {mapLink && (
                  <button
                    type="button"
                    className="ghost-btn small-btn"
                    onClick={() => openOnMap(event)}
                  >
                    На карте
                  </button>
                )}
                <time dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleString('ru-RU')}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
