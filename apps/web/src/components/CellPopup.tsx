import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { CellPlayersResponse, MapCell } from '../api/types';

function cellStatusTitle(data: CellPlayersResponse, cell: MapCell) {
  if (data.contested) {
    if (data.isOwner) {
      return data.tiedOnInfluence ? 'Спорная · вы ведёте (ничья)' : 'Спорная · вы ведёте';
    }
    if (data.tiedOnInfluence) {
      return 'Спорная · равное влияние';
    }
    const gap = data.contestGap ?? data.gapToLeader;
    return `Спорная · отстаёте на ${Math.ceil(gap)}`;
  }
  if (data.isOwner) {
    return 'Ваша клетка';
  }
  const ownerName = cell.ownerNickname ?? data.players[0]?.nickname;
  if (ownerName) {
    return `Владелец: ${ownerName}`;
  }
  return 'Свободная клетка';
}

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
    return <p className="cell-popup-loading">Загрузка…</p>;
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

  const leader = data.players[0];
  const gapToShow = Math.ceil(data.contestGap ?? data.gapToLeader);

  return (
    <div className={`cell-popup${data.contested ? ' cell-popup-contested' : ''}`}>
      <p className="cell-popup-title">{cellStatusTitle(data, cell)}</p>

      {data.players.length > 0 && (
        <div className="cell-popup-section">
          <p className="cell-popup-section-label">Влияние в клетке</p>
          <ol className="cell-popup-leaderboard">
            {data.players.map((player) => {
              const sharePct =
                data.leaderInfluence > 0
                  ? Math.round((player.influence / data.leaderInfluence) * 100)
                  : 0;
              return (
                <li key={player.userId} className={player.isMe ? 'is-me' : undefined}>
                  <div className="cell-popup-row-head">
                    <span>
                      {player.rank}. {player.nickname}
                      {player.isMe ? ' (вы)' : ''}
                    </span>
                    <strong>{Math.round(player.influence)}</strong>
                  </div>
                  <div className="cell-popup-share-bar" aria-hidden="true">
                    <span style={{ width: `${sharePct}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {data.contested && data.isOwner && (
        <p className="cell-popup-callout cell-popup-contested-callout cell-popup-meta">
          {data.tiedOnInfluence && data.challengerNickname
            ? `Ничья с ${data.challengerNickname} — удерживаете клетку, пока соперник не обгонит новой пробежкой`
            : data.challengerNickname
              ? `Соперник ${data.challengerNickname} близко · запас +${Math.round(data.leadOverNext ?? 0)}`
              : 'Клетка под угрозой захвата'}
        </p>
      )}

      {data.contested && !data.isOwner && (
        <div className="cell-popup-callout cell-popup-contested-callout">
          {data.tiedOnInfluence ? (
            <p>
              Равное влияние с <strong>{leader?.nickname}</strong>. Сделайте пробежку, чтобы
              обогнать по времени.
            </p>
          ) : (
            <>
              <p>
                Спор с <strong>{leader?.nickname}</strong> · отставание +{gapToShow}
              </p>
              <div className="cell-popup-progress">
                <div className="cell-popup-progress-bar">
                  <span style={{ width: `${progressPct}%` }} />
                </div>
                <p className="cell-popup-meta">
                  Ваш прогресс: {progressPct}% · нужно ещё +{gapToShow} влияния
                  {data.runsToCapture > 0 &&
                    ` (~${data.runsToCapture} пробеж${data.runsToCapture === 1 ? 'ка' : 'ки'})`}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {!data.contested && !data.isOwner && data.gapToLeader > 0 && leader && (
        <div className="cell-popup-callout">
          <p>
            Чтобы захватить, обгоните <strong>{leader.nickname}</strong>
          </p>
          <div className="cell-popup-progress">
            <div className="cell-popup-progress-bar">
              <span style={{ width: `${progressPct}%` }} />
            </div>
            <p className="cell-popup-meta">
              Ваш прогресс: {progressPct}% · нужно ещё +{Math.ceil(data.gapToLeader)} влияния
              {data.runsToCapture > 0 &&
                ` (~${data.runsToCapture} пробеж${data.runsToCapture === 1 ? 'ка' : 'ки'})`}
            </p>
          </div>
        </div>
      )}

      {!data.contested && data.isOwner && data.leadOverNext != null && data.leadOverNext > 0 && (
        <p className="cell-popup-callout cell-popup-meta">
          Вы лидируете · запас до 2-го места: +{Math.round(data.leadOverNext)}
        </p>
      )}

      {data.history.length > 0 && (
        <div className="cell-popup-history">
          <p className="cell-popup-section-label">История</p>
          <ul>
            {data.history.slice(0, 3).map((entry, index) => (
              <li key={`${entry.changedAt}-${index}`}>
                <span>
                  {entry.fromNickname ? `${entry.fromNickname} → ` : ''}
                  {entry.toNickname}
                </span>
                <time>{new Date(entry.changedAt).toLocaleDateString('ru-RU')}</time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
