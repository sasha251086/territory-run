import { useNavigate } from 'react-router-dom';
import type { ActivityItem } from '../api/types';
import { formatAnticheatMessage, canReprocess } from '../utils/anticheat-messages';
import { MAINTENANCE_RUN_SHORT } from '../utils/run-labels';
import { formatCellCount } from '../utils/territory';
import { ACTIVITY_FOCUS_KEY } from '../utils/activity-map-focus';

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} км`;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return 'Сегодня';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

type HexDisplay = {
  value: string;
  sublabel: string;
  tone: 'captured' | 'failed' | 'processing' | 'neutral' | 'updated';
};

function hexDisplay(item: ActivityItem): HexDisplay {
  if (item.status === 'processing') {
    return { value: '…', sublabel: 'обработка', tone: 'processing' };
  }
  if (item.status === 'failed') {
    return { value: '!', sublabel: 'ошибка', tone: 'failed' };
  }

  const captured = item.cellsCaptured ?? 0;
  const touched = item.cellsTouched ?? 0;

  if (captured > 0) {
    return { value: `+${captured}`, sublabel: 'клеток', tone: 'captured' };
  }
  if (touched > 0) {
    return { value: '0', sublabel: 'новых', tone: 'updated' };
  }
  return { value: '0', sublabel: 'клеток', tone: 'neutral' };
}

export default function ActivityCard({
  item,
  onReprocess,
  reprocessing,
}: {
  item: ActivityItem;
  onReprocess?: () => void;
  reprocessing?: boolean;
}) {
  const navigate = useNavigate();
  const hex = hexDisplay(item);
  const canOpenOnMap = item.status === 'completed';
  const pvpCaptures = item.pvpCaptures ?? 0;
  const territoryRefreshed =
    item.status === 'completed' &&
    (item.cellsCaptured ?? 0) === 0 &&
    (item.cellsTouched ?? 0) > 0;

  function openOnMap() {
    if (!canOpenOnMap) {
      return;
    }
    sessionStorage.setItem(ACTIVITY_FOCUS_KEY, item.id);
    navigate(`/?activity=${item.id}`);
  }

  return (
    <li className={`run-row${canOpenOnMap ? ' run-row--clickable' : ''}`}>
      <button
        type="button"
        className={`run-row__hex run-row__hex--${hex.tone}`}
        aria-label={`Захвачено: ${hex.value === '—' || hex.value === '…' ? hex.sublabel : formatCellCount(Number(hex.value.replace('+', '')))}`}
        onClick={openOnMap}
        disabled={!canOpenOnMap}
      >
        <span className="run-row__hex-value">{hex.value}</span>
        <span className="run-row__hex-label">{hex.sublabel}</span>
      </button>
      <button
        type="button"
        className="run-row__body run-row__body-btn"
        onClick={openOnMap}
        disabled={!canOpenOnMap}
      >
        <strong>{formatDistance(item.distanceMeters)}</strong>
        <span>{formatDate(item.startedAt)}</span>
        {item.status === 'processing' && (
          <>
            <span className="muted small">Обработка…</span>
            <div className="activity-processing-bar" aria-label="Обработка пробежки">
              <div className="activity-processing-bar__fill" />
            </div>
            <span className="activity-processing-bar__label">
              Считаем клетки… обычно &lt;30 сек
            </span>
          </>
        )}
        {item.status === 'failed' && (
          <span className="muted small">{formatAnticheatMessage(item.failureReason)}</span>
        )}
        {territoryRefreshed && (
          <span className="muted small">{MAINTENANCE_RUN_SHORT}</span>
        )}
        {item.status === 'completed' && pvpCaptures > 0 && (
          <span className="run-row__pvp-badge">
            у соперников · {pvpCaptures}
          </span>
        )}
      </button>
      <div className="run-row__actions">
        {item.status === 'failed' && canReprocess(item.failureReason) && onReprocess ? (
          <button
            type="button"
            className="ghost-btn small-btn"
            onClick={onReprocess}
            disabled={reprocessing}
          >
            {reprocessing ? '…' : 'Пересчёт'}
          </button>
        ) : canOpenOnMap ? (
          <button
            type="button"
            className="run-row__map-btn"
            onClick={openOnMap}
            aria-label="Открыть на карте"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
              />
            </svg>
          </button>
        ) : item.status === 'processing' ? (
          <span className="wire-badge wire-badge--pending">…</span>
        ) : null}
      </div>
    </li>
  );
}
