import type { ActivityItem } from '../api/types';
import { formatAnticheatMessage, canReprocess } from '../utils/anticheat-messages';

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(2)} км`;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return `${mins} мин`;
}

function sourceLabel(source: string) {
  if (source === 'strava') return 'Strava';
  if (source === 'gpx_import') return 'GPX';
  if (source === 'samsung_health_zip') return 'Samsung ZIP';
  if (source === 'samsung_health') return 'Samsung Health';
  if (source === 'apple_health') return 'Apple Health';
  if (source === 'health_connect') return 'Health Connect';
  return source;
}

function RouteThumbnail({ distanceMeters }: { distanceMeters: number }) {
  const complexity = Math.min(6, Math.max(3, Math.round(distanceMeters / 1500)));
  const points = Array.from({ length: complexity }, (_, index) => {
    const x = 8 + (index / (complexity - 1)) * 84;
    const y = 22 + Math.sin(index * 1.4) * 14 + (index % 2) * 6;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 56" className="activity-route-thumb" aria-hidden="true">
      <defs>
        <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3dff8a" />
          <stop offset="100%" stopColor="#45c8e7" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke="url(#routeGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
  return (
    <li className="activity-card">
      <div className="activity-card-thumb">
        <RouteThumbnail distanceMeters={item.distanceMeters} />
      </div>
      <div className="activity-card-body">
        <div className="activity-card-head">
          <strong>{sourceLabel(item.source)}</strong>
          <span className={`status ${item.status}`}>
            {item.status === 'failed' ? 'отклонена' : item.status === 'completed' ? 'готово' : 'обработка'}
          </span>
        </div>
        <p className="activity-card-date">{new Date(item.startedAt).toLocaleString('ru-RU')}</p>
        <div className="activity-card-metrics">
          <span>{formatDistance(item.distanceMeters)}</span>
          <span>{formatDuration(item.durationSeconds)}</span>
        </div>
        {item.status === 'failed' && (
          <p className="anticheat-msg">{formatAnticheatMessage(item.failureReason)}</p>
        )}
        {item.status === 'failed' && canReprocess(item.failureReason) && onReprocess && (
          <button
            type="button"
            className="ghost-btn small-btn"
            onClick={onReprocess}
            disabled={reprocessing}
          >
            Пересчитать
          </button>
        )}
      </div>
    </li>
  );
}
