import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { FeedEvent } from '../api/types';
import { formatFeedEvent } from '../utils/feed-format';
import { readSiegeNotificationsEnabled, requestSiegeNotifications } from '../hooks/useSiegeNotifications';

export default function MapSiegeBanner({ userId }: { userId?: string }) {
  const navigate = useNavigate();
  const [siege, setSiege] = useState<FeedEvent | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;
    void apiRequest<{ items: FeedEvent[] }>('/feed?limit=20')
      .then((data) => {
        if (cancelled) {
          return;
        }
        const latest = data.items.find(
          (event) => event.type === 'cell_siege' && event.userId === userId,
        );
        setSiege(latest ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setSiege(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!siege || siege.id === dismissedId) {
    return null;
  }

  const h3Index = siege.payload.h3Index;
  const mapLink =
    typeof h3Index === 'string' && h3Index
      ? `/?highlight=${encodeURIComponent(h3Index)}`
      : null;

  async function enableAlerts() {
    if (!readSiegeNotificationsEnabled()) {
      await requestSiegeNotifications();
    }
  }

  return (
    <div className="map-siege-banner" role="alert">
      <div className="map-siege-banner__content">
        <span className="wire-badge wire-badge--siege">Осада</span>
        <p>{formatFeedEvent(siege, userId)}</p>
      </div>
      <div className="map-siege-banner__actions">
        {mapLink && (
          <button
            type="button"
            className="primary-btn small-btn"
            onClick={() => {
              void enableAlerts();
              navigate(mapLink);
            }}
          >
            На карте
          </button>
        )}
        <button
          type="button"
          className="ghost-btn small-btn"
          onClick={() => setDismissedId(siege.id)}
        >
          Скрыть
        </button>
      </div>
    </div>
  );
}
