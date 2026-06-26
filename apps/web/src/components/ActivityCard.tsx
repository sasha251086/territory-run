import { useNavigate } from 'react-router-dom';
import type { ActivityItem } from '../api/types';
import { formatAnticheatMessage, canReprocess } from '../utils/anticheat-messages';
import { formatCellCount } from '../utils/territory';

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

function cellsCapturedLabel(item: ActivityItem) {
  if (item.status === 'processing') {
    return '…';
  }
  const captured = item.cellsCaptured ?? item.cellsTouched;
  if (captured == null) {
    return '—';
  }
  return String(captured);
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
  const cellsLabel = cellsCapturedLabel(item);
  const hexClass =
    item.status === 'completed' &&
    (item.cellsCaptured ?? item.cellsTouched ?? 0) > 0
      ? 'run-row__hex run-row__hex--captured'
      : item.status === 'failed'
        ? 'run-row__hex run-row__hex--failed'
        : item.status === 'processing'
          ? 'run-row__hex run-row__hex--processing'
          : 'run-row__hex';

  const canOpenOnMap = item.status === 'completed';

  function openOnMap() {
    if (!canOpenOnMap) {
      return;
    }
    navigate(`/?activity=${item.id}`);
  }

  return (
    <li className={`run-row${canOpenOnMap ? ' run-row--clickable' : ''}`}>
      <button
        type="button"
        className={hexClass}
        aria-label={`Захвачено: ${
          cellsLabel === '—' || cellsLabel === '…'
            ? cellsLabel
            : formatCellCount(Number(cellsLabel))
        }`}
        onClick={openOnMap}
        disabled={!canOpenOnMap}
      >
        <span>{cellsLabel}</span>
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
          <span className="muted small">Обработка…</span>
        )}
        {item.status === 'failed' && (
          <span className="muted small">{formatAnticheatMessage(item.failureReason)}</span>
        )}
        {item.status === 'completed' && (item.pvpCaptures ?? 0) > 0 && (
          <span className="muted small">PvP: {item.pvpCaptures}</span>
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
          <button type="button" className="ghost-btn small-btn" onClick={openOnMap}>
            Карта
          </button>
        ) : item.status === 'processing' ? (
          <span className="wire-badge wire-badge--pending">…</span>
        ) : null}
      </div>
    </li>
  );
}
