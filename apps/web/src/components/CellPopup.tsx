import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { CellPlayersResponse, MapCell } from '../api/types';
import { getHexagonAreaAvg } from 'h3-js';

const CELL_AREA_M2 = getHexagonAreaAvg(9, 'm2');

export default function CellPopupContent({ cell }: { cell: MapCell }) {
  const [data, setData] = useState<CellPlayersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void apiRequest<CellPlayersResponse>(`/map/cells/${cell.h3Index}/players`)
      .then((response) => {
        if (!cancelled) {
          setData(response);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cell.h3Index]);

  if (loading) {
    return <p className="cell-popup-loading">Загрузка...</p>;
  }

  if (error || !data) {
    return (
      <div className="cell-popup">
        <strong>{cell.ownerNickname || 'Свободна'}</strong>
        <p className="cell-popup-error">{error ?? 'Нет данных'}</p>
      </div>
    );
  }

  const progressPct =
    data.leaderInfluence > 0
      ? Math.min(100, Math.round((data.myInfluence / data.leaderInfluence) * 100))
      : 0;

  return (
    <div className="cell-popup">
      <p className="cell-popup-kicker">~{Math.round(CELL_AREA_M2)} m² за клетку</p>
      <p className="cell-popup-title">
        {data.isOwner ? 'Вы владелец' : cell.ownerNickname || 'Свободна'}
      </p>

      {data.myRank != null && (
        <p className="cell-popup-meta">
          Ваше место: #{data.myRank} · влияние {Math.round(data.myInfluence)}
        </p>
      )}

      {!data.isOwner && data.gapToLeader > 0 && (
        <div className="cell-popup-progress">
          <div className="cell-popup-progress-bar">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <p>
            До захвата: ~{data.runsToCapture} пробеж{data.runsToCapture === 1 ? 'ка' : 'ки'} (
            +{Math.ceil(data.gapToLeader)} влияния)
          </p>
        </div>
      )}

      {data.isOwner && data.leadOverNext != null && (
        <p className="cell-popup-meta">Отрыв от #2: +{Math.round(data.leadOverNext)}</p>
      )}

      {data.players.length > 0 && (
        <ol className="cell-popup-leaderboard">
          {data.players.map((player) => (
            <li key={player.userId} className={player.isMe ? 'is-me' : undefined}>
              <span>
                {player.rank}. {player.nickname}
                {player.isMe ? ' (вы)' : ''}
              </span>
              <em>{Math.round(player.influence)}</em>
            </li>
          ))}
        </ol>
      )}

      {data.history.length > 0 && (
        <div className="cell-popup-history">
          <strong>История</strong>
          <ul>
            {data.history.map((entry, index) => (
              <li key={`${entry.changedAt}-${index}`}>
                {entry.fromNickname ? `${entry.fromNickname} → ` : ''}
                {entry.toNickname}
                <span>{new Date(entry.changedAt).toLocaleDateString('ru-RU')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
