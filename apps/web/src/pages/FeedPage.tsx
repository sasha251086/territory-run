import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { FeedEvent } from '../api/types';

export default function FeedPage() {
  const [items, setItems] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest<{ items: FeedEvent[] }>('/feed?limit=30');
        setItems(data.items);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <div className="stack">
      <section className="card">
        <h2>Лента событий</h2>
        {loading ? (
          <p className="muted">Загрузка...</p>
        ) : items.length === 0 ? (
          <p className="muted">Событий пока нет.</p>
        ) : (
          <ul className="list">
            {items.map((event) => (
              <li key={event.id} className="list-item">
                <div>
                  <strong>{event.user.nickname}</strong>
                  <p>{event.type}</p>
                </div>
                <span className="list-meta">{new Date(event.createdAt).toLocaleString('ru-RU')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
