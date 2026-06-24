import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { FeedEvent } from '../api/types';
import { useAuth } from '../context/AuthContext';
import {
  feedEventAction,
  feedEventIcon,
  feedEventVariant,
  formatFeedEvent,
  formatRelativeTime,
} from '../utils/feed-ui';

type FeedTab = 'all' | 'rivals';

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
        if (!cancelled) setItems(data.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div className="tr-screen">
      <h1 className="tr-screen__title">Лента</h1>

      <div className="tr-segmented">
        <button
          type="button"
          className={`tr-segmented__btn${tab === 'all' ? ' tr-segmented__btn--active' : ''}`}
          onClick={() => setTab('all')}
        >
          Все события
        </button>
        <button
          type="button"
          className={`tr-segmented__btn${tab === 'rivals' ? ' tr-segmented__btn--active' : ''}`}
          onClick={() => setTab('rivals')}
        >
          Соперники
        </button>
      </div>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="muted">
          {tab === 'rivals'
            ? 'Добавьте соперников в рейтинге, чтобы видеть их события.'
            : 'Событий пока нет.'}
        </p>
      ) : (
        <ul style={{ display: 'grid', gap: 10, margin: 0, padding: 0 }}>
          {items.map((event) => {
            const variant = feedEventVariant(event, user?.id);
            const action = feedEventAction(event, variant, user?.id);
            const displayName = event.userId === user?.id ? 'вы' : event.user.nickname;

            return (
              <li key={event.id} className={`tr-feed-card tr-feed-card--${variant}`}>
                <div className="tr-feed-card__head">
                  <span className="tr-feed-card__icon">{feedEventIcon(variant, event)}</span>
                  <span className="tr-feed-card__user">{displayName}</span>
                  <time className="tr-feed-card__time" dateTime={event.createdAt}>
                    {formatRelativeTime(event.createdAt)}
                  </time>
                </div>
                <p className="tr-feed-card__text">{formatFeedEvent(event)}</p>
                {action && (
                  <button
                    type="button"
                    className={`tr-feed-card__action tr-feed-card__action--${action.type}`}
                    onClick={() => {
                      if (action.label.includes('Отвоевать')) navigate('/');
                      else if (navigator.share) {
                        void navigator.share({ text: formatFeedEvent(event), title: 'Territory Run' });
                      }
                    }}
                  >
                    {action.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
