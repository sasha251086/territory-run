import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { FeedEvent } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { cellCountWord } from '../utils/territory';
import {
  buildFeedList,
  formatFeedBadge,
  formatFeedBadgeClass,
  formatFeedEvent,
  formatFeedRowClass,
  groupLabel,
  siegeHistoryLine,
  formatSiegeGapRange,
  formatSiegeGroupSummary,
} from '../utils/feed-group';
import { isImportantFeedEvent, isMaintenanceFeedEvent } from '../utils/feed-format';

type FeedTab = 'all' | 'important' | 'rivals';

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
  const [tab, setTab] = useState<FeedTab>('important');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const filteredItems = (() => {
    if (tab === 'important') {
      return items.filter(isImportantFeedEvent);
    }
    if (tab === 'all') {
      return items.filter((event) => !isMaintenanceFeedEvent(event));
    }
    return items;
  })();
  const feedEntries = buildFeedList(filteredItems);

  return (
    <div className="page-screen">
      <h1 className="page-title">Лента</h1>

      <div className="segmented segmented--3">
        <button
          type="button"
          className={tab === 'all' ? 'active' : undefined}
          onClick={() => setTab('all')}
        >
          Все
        </button>
        <button
          type="button"
          className={tab === 'important' ? 'active' : undefined}
          onClick={() => setTab('important')}
        >
          Важное
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
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <h3>{tab === 'important' ? 'Ничего важного' : 'Пока тихо'}</h3>
          <p className="muted">
            {tab === 'important'
              ? 'Здесь осады, захваты и пробежки с новыми клетками.'
              : tab === 'all'
                ? 'Пока только пробежки без захватов — они не показываются во вкладке «Все».'
                : tab === 'rivals'
                ? 'Добавьте соперников в рейтинге, чтобы видеть их события.'
                : 'Здесь появятся события после первой пробежки.'}
          </p>
        </div>
      ) : (
        <ul className="feed-list">
          {feedEntries.map((entry) => {
            if (entry.kind === 'siege') {
              const expanded = expandedGroups.has(entry.key);
              const latest = entry.events[0]!;
              const gapRange = formatSiegeGapRange(entry.events);
              const cellCount = entry.events.length;

              return (
                <li key={entry.key} className="feed-row feed-row--siege feed-row--group">
                  <div className="feed-row__head">
                    <strong>{entry.user.nickname}</strong>
                    <span className="wire-badge wire-badge--siege">
                      осада · {cellCount} {cellCountWord(cellCount)}
                    </span>
                  </div>
                  <p>{formatSiegeGroupSummary(entry.events, user?.id)}</p>
                  <button
                    type="button"
                    className="ghost-btn small-btn"
                    onClick={() => toggleGroup(entry.key)}
                  >
                    {expanded ? 'Свернуть' : 'По клеткам'}
                  </button>
                  {expanded && (
                    <ul className="feed-group-details feed-siege-history">
                      {entry.events.map((event) => {
                        const mapLink = siegeMapLink(event);
                        return (
                          <li key={event.id}>
                            <span>{formatFeedEvent(event, user?.id)}</span>
                            <span>{siegeHistoryLine(event)}</span>
                            {mapLink && (
                              <button
                                type="button"
                                className="ghost-btn small-btn"
                                onClick={() => openOnMap(event)}
                              >
                                На карте
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {!expanded && siegeMapLink(latest) && (
                    <button type="button" className="ghost-btn small-btn" onClick={() => openOnMap(latest)}>
                      На карте ({gapRange})
                    </button>
                  )}
                  <time>{new Date(latest.createdAt).toLocaleString('ru-RU')}</time>
                </li>
              );
            }

            if (entry.kind === 'group') {
              const expanded = expandedGroups.has(entry.key);
              return (
                <li key={entry.key} className="feed-row feed-row--group">
                  <div className="feed-row__head">
                    <strong>{entry.user.nickname}</strong>
                    <span className="wire-badge wire-badge--group">{entry.events.length} за день</span>
                  </div>
                  <p>{groupLabel(entry.events)}</p>
                  <button
                    type="button"
                    className="ghost-btn small-btn"
                    onClick={() => toggleGroup(entry.key)}
                  >
                    {expanded ? 'Свернуть' : 'Подробнее'}
                  </button>
                  {expanded && (
                    <ul className="feed-group-details">
                      {entry.events.map((event) => (
                        <li key={event.id} className={formatFeedRowClass(event)}>
                          <p>{formatFeedEvent(event, user?.id)}</p>
                          <time>{new Date(event.createdAt).toLocaleString('ru-RU')}</time>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            }

            const event = entry.event;
            const badge = formatFeedBadge(event);
            const mapLink = siegeMapLink(event);

            return (
              <li key={event.id} className={formatFeedRowClass(event)}>
                <div className="feed-row__head">
                  <strong>{event.user.nickname}</strong>
                  {badge && <span className={formatFeedBadgeClass(event)}>{badge}</span>}
                </div>
                <p>{formatFeedEvent(event, user?.id)}</p>
                {mapLink && (
                  <button type="button" className="ghost-btn small-btn" onClick={() => openOnMap(event)}>
                    На карте
                  </button>
                )}
                <time>{new Date(event.createdAt).toLocaleString('ru-RU')}</time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
