import type { ActivityItem } from '../api/types';

import { formatAnticheatMessage, canReprocess } from '../utils/anticheat-messages';



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



function resultBadge(status: ActivityItem['status']) {

  if (status === 'failed') return 'ERR';

  if (status === 'completed') return 'OK';

  return '…';

}



function cellsCapturedLabel(item: ActivityItem) {

  if (item.status === 'processing') {

    return '…';

  }

  if (item.cellsCaptured == null) {

    return '—';

  }

  return String(item.cellsCaptured);

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

  const cellsLabel = cellsCapturedLabel(item);

  const hexClass =

    item.status === 'completed' && (item.cellsCaptured ?? 0) > 0

      ? 'run-row__hex run-row__hex--captured'

      : item.status === 'failed'

        ? 'run-row__hex run-row__hex--failed'

        : 'run-row__hex';



  return (

    <li className="run-row">

      <div className={hexClass} aria-label={`Захвачено клеток: ${cellsLabel}`}>

        <span>{cellsLabel}</span>

      </div>

      <div className="run-row__body">

        <strong>{formatDistance(item.distanceMeters)}</strong>

        <span>{formatDate(item.startedAt)}</span>

        {item.status === 'failed' && (

          <span className="muted small">{formatAnticheatMessage(item.failureReason)}</span>

        )}

      </div>

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

        ) : (

          <span className="wire-badge">{resultBadge(item.status)}</span>

        )}

      </div>

    </li>

  );

}


