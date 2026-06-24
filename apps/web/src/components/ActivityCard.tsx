import type { ActivityItem } from '../api/types';
import { canReprocess, getAnticheatMessage } from '../utils/anticheat-messages';

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} км`;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return `${mins} мин`;
}

function formatRelativeDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Сегодня, ${time}`;
  if (diffDays === 1) return `Вчера, ${time}`;
  const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' });
  return `${weekday}, ${time}`;
}

export default function ActivityCard({
  item,
  onReprocess,
  reprocessing,
  reprocessError,
}: {
  item: ActivityItem;
  onReprocess?: (activityId: string) => void;
  reprocessing?: boolean;
  reprocessError?: string | null;
}) {
  const isFailed = item.status === 'failed';
  const isOk = item.status === 'completed';
  const isProcessing = item.status === 'processing';
  const anticheat = isFailed ? getAnticheatMessage(item.failureReason) : null;

  return (
    <li className={`tr-activity-card${isFailed ? ' tr-activity-card--error' : ''}`}>
      <div className="tr-activity-card__head">
        <span className="tr-activity-card__date">{formatRelativeDate(item.startedAt)}</span>
        <span
          className={`tr-status-pill${
            isOk ? ' tr-status-pill--ok' : isFailed ? ' tr-status-pill--error' : ' tr-status-pill--pending'
          }`}
        >
          {isOk ? '• OK' : isFailed ? '• Ошибка' : isProcessing && reprocessing ? '• …' : '• …'}
        </span>
      </div>
      <div className="tr-activity-card__body">
        <div>
          <div className="tr-activity-card__distance">{formatDistance(item.distanceMeters)}</div>
          {isOk && <div className="tr-activity-card__gain">+— кл</div>}
          {isFailed && <div className="tr-activity-card__gain">—</div>}
        </div>
        <span className="tr-activity-card__duration">{formatDuration(item.durationSeconds)}</span>
      </div>
      {isProcessing && reprocessing && (
        <p className="anticheat-msg">Повторная проверка…</p>
      )}
      {isFailed && anticheat && (
        <>
          <p className="anticheat-msg">
            <strong>{anticheat.title}</strong>
            <br />
            {anticheat.description}
          </p>
          {canReprocess(item.failureReason) && onReprocess && (
            <button
              type="button"
              className="tr-btn-reprocess"
              onClick={() => onReprocess(item.id)}
              disabled={reprocessing}
            >
              {reprocessing ? 'Повторная проверка…' : 'Пересчитать'}
            </button>
          )}
          {reprocessError && <p className="error-banner">{reprocessError}</p>}
        </>
      )}
    </li>
  );
}
