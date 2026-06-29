import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { FeedEvent } from '../api/types';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import SkeletonList from '../components/SkeletonList';
import { cellCountWord } from '../utils/territory';
import { feedEventColor, feedEventIcon } from '../utils/feed-icons';
import { relativeTime } from '../utils/relative-time';
import {
  buildFeedList,
  formatFeedEvent,
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

  const siegeCount = useMemo(
    () => filteredItems.filter((e) => e.type === 'cell_siege').length,
    [filteredItems],
  );

  const feedEntries = buildFeedList(filteredItems);

  return (
    <div className="page-screen">
      <h1 className="page-title">
        Лента
        {siegeCount > 0 && (
          <span className="page-title__badge">{siegeCount}</span>
        )}
      </h1>

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
        <SkeletonList rows={6} />
      ) : filteredItems.length === 0 ? (
        tab === 'important' ? (
          <EmptyState
            icon="🏃"
            title="Пока тихо"
            text="Осады, захваты районов и новые клетки появятся здесь."
            action={
              <Link to="/" className="primary-btn">
                Открыть карту
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon="📋"
            title={tab === 'all' ? 'Пока тихо' : 'Нет событий'}
            text={
              tab === 'all'
                ? 'Пока только пробежки без захватов — они не показываются во вкладке «Все».'
                : 'Добавьте соперников в рейтинге, чтобы видеть их события.'
            }
          />
        )
      ) : (
        <ul className="feed-list">
          {feedEntries.map((entry) => {
            if (entry.kind === 'siege') {
              const expanded = expandedGroups.has(entry.key);
              const latest = entry.events[0]!;
              const gapRange = formatSiegeGapRange(entry.events);
              const cellCount = entry.events.length;

              return (
                <li key={entry.key} className="feed-row feed-row--siege-group">
                  <div className="feed-row__icon" style={{ color: feedEventColor('cell_siege') }}>
                    {feedEventIcon('cell_siege')}
                  </div>
                  <div className="feed-row__body">
                    <div className="feed-row__head">
                      <strong className="feed-row__nick">{entry.user.nickname}</strong>
                      <time
                        className="feed-row__time"
                        title={new Date(latest.createdAt).toLocaleString('ru-RU')}
                      >
                        {relativeTime(latest.createdAt)}
                      </time>
                    </div>
                    <p className="feed-row__text">
                      {formatSiegeGroupSummary(entry.events, user?.id)} · {cellCount}{' '}
                      {cellCountWord(cellCount)}
                    </p>
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
                                  className="ghost-btn small-btn feed-row__link"
                                  onClick={() => openOnMap(event)}
                                >
                                  На карте →
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {!expanded && siegeMapLink(latest) && (
                      <button
                        type="button"
                        className="ghost-btn small-btn feed-row__link"
                        onClick={() => openOnMap(latest)}
                      >
                        На карте ({gapRange}) →
                      </button>
                    )}
                  </div>
                </li>
              );
            }

            if (entry.kind === 'group') {
              const expanded = expandedGroups.has(entry.key);
              const latest = entry.events[0]!;
              return (
                <li key={entry.key} className="feed-row feed-row--group">
                  <div className="feed-row__icon" style={{ color: feedEventColor('activity_completed') }}>
                    {feedEventIcon('activity_completed')}
                  </div>
                  <div className="feed-row__body">
                    <div className="feed-row__head">
                      <strong className="feed-row__nick">{entry.user.nickname}</strong>
                      <time
                        className="feed-row__time"
                        title={new Date(latest.createdAt).toLocaleString('ru-RU')}
                      >
                        {relativeTime(latest.createdAt)}
                      </time>
                    </div>
                    <p className="feed-row__text">{groupLabel(entry.events)}</p>
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
                          <li key={event.id}>
                            <p>{formatFeedEvent(event, user?.id)}</p>
                            <time
                              className="feed-row__time"
                              title={new Date(event.createdAt).toLocaleString('ru-RU')}
                            >
                              {relativeTime(event.createdAt)}
                            </time>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            }

            const event = entry.event;
            const mapLink = siegeMapLink(event);

            return (
              <li
                key={event.id}
                className={`feed-row feed-row--${event.type.replace(/_/g, '-')}`}
              >
                <div className="feed-row__icon" style={{ color: feedEventColor(event.type) }}>
                  {feedEventIcon(event.type)}
                </div>
                <div className="feed-row__body">
                  <div className="feed-row__head">
                    <strong className="feed-row__nick">{event.user.nickname}</strong>
                    <time
                      className="feed-row__time"
                      title={new Date(event.createdAt).toLocaleString('ru-RU')}
                    >
                      {relativeTime(event.createdAt)}
                    </time>
                  </div>
                  <p className="feed-row__text">{formatFeedEvent(event, user?.id)}</p>
                  {mapLink && (
                    <button
                      type="button"
                      className="feed-row__link ghost-btn small-btn"
                      onClick={() => openOnMap(event)}
                    >
                      На карте →
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
