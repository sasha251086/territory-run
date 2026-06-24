import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { FeedEvent } from '../api/types';
import { formatFeedEvent } from '../utils/feed-format';
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
    <div className="stack game-screen">
      <section className="screen-hero">
        <p className="eyebrow">City Log</p>
        <h1>Лента событий</h1>
        <p>Следите, кто расширяет территорию, возвращает районы и набирает влияние.</p>
      </section>

      <section className="card compact-card">
        <div className="tabs">
          <button
            type="button"
            className={tab === 'all' ? 'tab active' : 'tab'}
            onClick={() => setTab('all')}
          >
            Все
          </button>
          <button
            type="button"
            className={tab === 'rivals' ? 'tab active' : 'tab'}
            onClick={() => setTab('rivals')}
          >
            Соперники
          </button>
        </div>
      </section>

      <section className="card">
        <h2>{tab === 'rivals' ? 'Соперники' : 'Лента событий'}</h2>
        {loading ? (
          <p className="muted">Загрузка...</p>
        ) : items.length === 0 ? (
          <p className="muted">
            {tab === 'rivals'
              ? 'Добавьте соперников в рейтинге или профиле, чтобы видеть их события.'
              : 'Событий пока нет.'}
          </p>
        ) : (
          <ul className="feed-list">
            {items.map((event) => {
              if (event.type === 'cell_siege') {
                const mapLink = siegeMapLink(event);
                const isMine = event.userId === user?.id;
                return (
                  <li key={event.id} className="feed-card feed-card--siege">
                    <div className="feed-card__siege-head">
                      <span aria-hidden="true">🛡</span>
                      <strong>{isMine ? 'Осада вашей клетки' : 'Осада клетки'}</strong>
                    </div>
                    <p>{formatFeedEvent(event, user?.id)}</p>
                    {mapLink && (
                      <button
                        type="button"
                        className="ghost-btn small-btn"
                        onClick={() => openOnMap(event)}
                      >
                        Посмотреть на карте
                      </button>
                    )}
                    <time dateTime={event.createdAt}>
                      {new Date(event.createdAt).toLocaleString('ru-RU')}
                    </time>
                  </li>
                );
              }

              return (
                <li key={event.id} className="feed-card">
                  <strong>{event.user.nickname}</strong>
                  <p>{formatFeedEvent(event, user?.id)}</p>
                  <time dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString('ru-RU')}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
