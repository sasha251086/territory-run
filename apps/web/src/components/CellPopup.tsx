import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { CellPlayersResponse, MapCell } from '../api/types';
import { getHexagonAreaAvg } from 'h3-js';
import { runsToCaptureFromGap } from '../utils/anticheat-messages';

const CELL_AREA_M2 = getHexagonAreaAvg(9, 'm2');

function shortCellId(h3Index: string) {
  return h3Index.slice(-6).toUpperCase();
}

function decayLabel(cell: MapCell) {
  if (cell.decayRisk === 'critical') return 'crit';
  if (cell.decayRisk === 'warning') return 'decay';
  return null;
}

export function useCellPlayers(cell: MapCell | null) {
  const [data, setData] = useState<CellPlayersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cell) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void apiRequest<CellPlayersResponse>(`/map/cells/${cell.h3Index}/players`)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cell?.h3Index]);

  return { data, loading, error };
}

export function CellPreviewCard({
  cell,
  onDetails,
}: {
  cell: MapCell;
  onDetails: () => void;
}) {
  const { data, loading } = useCellPlayers(cell);
  const decay = decayLabel(cell);

  return (
    <section className="tr-map-cell-card tr-glass">
      <div className="tr-map-cell-card__head">
        <span className="tr-map-cell-card__id">клетка #{shortCellId(cell.h3Index)}</span>
        {decay && (
          <span className="tr-badge tr-badge--orange">⚠ {decay}</span>
        )}
      </div>
      <p className="tr-map-cell-card__owner">
        {loading ? '…' : data?.isOwner ? 'вы' : cell.ownerNickname || 'Свободна'}
      </p>
      {data && (
        <p className="tr-map-cell-card__meta">
          влияние {Math.round(data.leaderInfluence)}
          {data.myRank != null && ` · вы #${data.myRank} (${Math.round(data.myInfluence)})`}
        </p>
      )}
      <button type="button" className="tr-btn tr-btn-primary" onClick={onDetails}>
        Детали →
      </button>
    </section>
  );
}

function CellPositionBlock({
  data,
  progressPct,
}: {
  data: CellPlayersResponse;
  progressPct: number;
}) {
  const hasInfluence = data.myInfluence > 0;

  if (!hasInfluence) {
    return <p className="tr-map-cell-card__meta">Вы здесь не бегали</p>;
  }

  if (data.isOwner || data.myRank === 1) {
    return (
      <>
        <p className="tr-map-cell-card__meta">Вы владелец</p>
        {data.totalPlayers > 1 && data.leadOverNext != null && (
          <p className="tr-map-cell-card__meta">
            Отрыв от #2: +{Math.round(data.leadOverNext)}
          </p>
        )}
      </>
    );
  }

  const runsNeeded = data.runsToCapture || runsToCaptureFromGap(data.gapToLeader);

  return (
    <>
      <div className="tr-cell-sheet__progress-head">
        <span>
          Вы #{data.myRank} из {data.totalPlayers}
        </span>
        <span>
          {Math.round(data.myInfluence)} / {Math.round(data.leaderInfluence)}
        </span>
      </div>
      <div className="tr-progress">
        <div className="tr-progress__fill" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="tr-map-cell-card__meta" style={{ marginTop: 8 }}>
        Нужно ещё ~{runsNeeded} пробеж{runsNeeded === 1 ? 'ка' : runsNeeded < 5 ? 'ки' : 'ек'}
      </p>
    </>
  );
}

export default function CellPopupContent({
  cell,
  onClose,
}: {
  cell: MapCell;
  onClose?: () => void;
}) {
  const { data, loading, error } = useCellPlayers(cell);

  if (loading) {
    return <p className="cell-popup-loading">Загрузка…</p>;
  }

  if (error || !data) {
    return (
      <div className="tr-cell-sheet">
        <p className="cell-popup-error">{error ?? 'Нет данных'}</p>
      </div>
    );
  }

  const progressPct =
    data.leaderInfluence > 0
      ? Math.min(100, Math.round((data.myInfluence / data.leaderInfluence) * 100))
      : 0;

  return (
    <div className="tr-cell-sheet">
      <div className="tr-cell-sheet__hex" aria-hidden="true">
        <span className="tr-cell-hex tr-cell-hex--other" />
        <span className="tr-cell-hex tr-cell-hex--rival" />
        <span className="tr-cell-hex tr-cell-hex--center" />
        <span className="tr-cell-hex tr-cell-hex--decay" />
        <span className="tr-cell-hex tr-cell-hex--other" />
      </div>

      <div className="tr-cell-sheet__header">
        <div>
          <p className="tr-map-cell-card__id">
            клетка #{shortCellId(cell.h3Index)} · ~{Math.round(CELL_AREA_M2)} м²
          </p>
          <h2 className="tr-cell-sheet__title">
            Владелец: {data.isOwner ? 'вы' : cell.ownerNickname || '—'}
          </h2>
        </div>
        {onClose && (
          <button type="button" className="tr-cell-sheet__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        )}
      </div>

      <section className="tr-cell-sheet__progress-card tr-glass">
        <h3>Ваша позиция</h3>
        <CellPositionBlock data={data} progressPct={progressPct} />
      </section>

      {data.players.length > 0 && (
        <section>
          <h3>Топ игроков</h3>
          <ol className="tr-cell-players">
            {data.players.map((player) => {
              const pct =
                data.leaderInfluence > 0
                  ? Math.min(100, Math.round((player.influence / data.leaderInfluence) * 100))
                  : 0;
              return (
                <li key={player.userId} className={player.isMe ? 'is-me' : undefined}>
                  <span className="tr-cell-players__rank">{player.rank}</span>
                  <div>
                    <div>{player.isMe ? 'вы' : player.nickname}</div>
                    <div className="tr-cell-players__bar-wrap">
                      <span className="tr-cell-players__bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="tr-cell-players__score">{Math.round(player.influence)}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {data.history.length > 0 && (
        <section className="tr-cell-history">
          <h3>История</h3>
          <ul>
            {data.history.map((entry, index) => {
              const daysAgo = Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(entry.changedAt).getTime()) / (1000 * 60 * 60 * 24),
                ),
              );
              const label =
                daysAgo === 0
                  ? 'сегодня'
                  : daysAgo === 1
                    ? '1 дн'
                    : `${daysAgo} дн`;
              return (
                <li key={`${entry.changedAt}-${index}`}>
                  {label}{' '}
                  <strong>{entry.toNickname}</strong>
                  {entry.fromNickname ? ` захватил у ${entry.fromNickname}` : ' первое посещение'}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
