import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { CellPlayersResponse, MapCell } from '../api/types';
import {
  DECAY_DELETE_AFTER_DAYS,
  DECAY_GRACE_DAYS,
  DECAY_PERCENT_PER_DAY,
  displayInfluence,
} from '../constants/game';
import {
  freshnessLabel,
  visitFreshnessBarPct,
  visitFreshnessCaption,
  resolveDaysSinceMyActivity,
  daysAgoLabel,
  type FreshnessStatus,
} from '../utils/cell-lifespan';
import './cell-popup.css';

function showInf(value: number): number {
  return displayInfluence(value);
}

type CellAction = {
  headline: string;
  subtitle: string;
  action: string;
  tone: 'neutral' | 'own' | 'capture' | 'defend' | 'contest';
};

function resolveCellAction(data: CellPlayersResponse, cell: MapCell): CellAction {
  if (data.contested && data.isOwner) {
    const challenger = data.challengerNickname ?? 'Соперник';
    const gap = data.contestGap != null ? showInf(data.contestGap) : null;
    if (data.tiedOnInfluence) {
      return {
        headline: 'Защита клетки',
        subtitle: `Ничья с ${challenger}`,
        action: 'Пробегитесь здесь, чтобы удержать контроль',
        tone: 'defend',
      };
    }
    if (gap != null && gap <= 3) {
      return {
        headline: 'Срочная защита',
        subtitle: `${challenger} почти догнал`,
        action: `До потери клетки ${gap} — пробегитесь сейчас`,
        tone: 'defend',
      };
    }
    return {
      headline: 'Клетка под атакой',
      subtitle: `Атакует ${challenger}`,
      action: gap != null ? `Запас ${gap} — пробегитесь, чтобы удержать` : 'Пробегитесь здесь, чтобы удержать',
      tone: 'defend',
    };
  }

  if (data.contested && !data.isOwner) {
    const gap = showInf(data.contestGap ?? data.gapToLeader);
    const runs = data.runsToCapture > 0 ? ` (~${data.runsToCapture} проб.)` : '';
    const owner = cell.ownerNickname ?? data.players[0]?.nickname ?? 'лидер';
    return {
      headline: 'Спор за клетку',
      subtitle: `Сейчас ведёт ${owner}`,
      action: `Нужно +${gap} силы для захвата${runs}`,
      tone: 'contest',
    };
  }

  if (data.isOwner) {
    if (data.leadOverNext != null && data.leadOverNext > 0) {
      const lead = showInf(data.leadOverNext);
      return {
        headline: 'Ваша клетка',
        subtitle: lead <= 3 ? 'Соперник близко' : `Запас над соперником: ${lead}`,
        action: lead <= 3 ? 'Пробегитесь, чтобы укрепить позицию' : 'Клетка под контролем — пробегитесь для свежести',
        tone: 'own',
      };
    }
    return {
      headline: 'Ваша клетка',
      subtitle: 'Вы контролируете эту зону',
      action: 'Пробегитесь через клетку, чтобы не потерять след',
      tone: 'own',
    };
  }

  if (data.gapToLeader > 0 && data.players[0]) {
    return {
      headline: 'Захват',
      subtitle: `Владелец: ${data.players[0].nickname}`,
      action: `Нужно +${showInf(data.gapToLeader)} силы для захвата`,
      tone: 'capture',
    };
  }

  if (cell.ownerNickname) {
    return {
      headline: 'Чужая клетка',
      subtitle: `Владелец: ${cell.ownerNickname}`,
      action: `Сила лидера: ${showInf(data.leaderInfluence)}`,
      tone: 'neutral',
    };
  }

  return {
    headline: 'Свободная клетка',
    subtitle: 'Никто не контролирует',
    action: 'Пробегитесь здесь, чтобы захватить',
    tone: 'capture',
  };
}

function freshnessBadgeClass(freshness: FreshnessStatus | undefined): string {
  switch (freshness) {
    case 'warning':
      return 'cell-popup-badge--warning';
    case 'critical':
      return 'cell-popup-badge--critical';
    default:
      return 'cell-popup-badge--fresh';
  }
}

export default function CellPopupContent({ cell }: { cell: MapCell }) {
  const [data, setData] = useState<CellPlayersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetailsOpen(false);

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
  }, [cell.h3Index]);

  if (loading) {
    return (
      <div className="cell-popup-skeleton" aria-busy="true" aria-label="Загрузка">
        <div className="skel-line skel-line--title" />
        <div className="skel-line skel-line--body" />
        <div className="skel-line skel-line--body skel-line--short" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="cell-popup">
        <strong>{cell.ownerNickname || 'Свободна'}</strong>
        <p className="cell-popup-error">{error ?? 'Нет данных'}</p>
      </div>
    );
  }

  const freshness = data.freshness ?? 'fresh';
  const action = resolveCellAction(data, cell);
  const daysSinceMyActivity = resolveDaysSinceMyActivity(
    data.daysSinceMyActivity,
    data.myLastActivityAt,
    cell.myLastActivityAt ?? null,
  );
  const visitBarPct = visitFreshnessBarPct(
    daysSinceMyActivity,
    freshness,
    data.myInfluence,
  );
  const visitCaption = visitFreshnessCaption(
    daysSinceMyActivity,
    freshness,
    data.dailyInfluenceLoss ?? 0,
    data.daysUntilWipe,
    data.myInfluence,
  );
  const lastVisitLabel =
    daysSinceMyActivity != null ? daysAgoLabel(daysSinceMyActivity) : null;
  const hasPlayers = data.players.length > 0;
  const hasHistory = data.history.length > 0;
  const myDisplay = data.myInfluence > 0 ? showInf(data.myInfluence) : null;
  const showOpponentMetric = myDisplay != null && data.players.filter((p) => !p.isMe).length === 0;
  const opponent = data.players.find((player) => !player.isMe && player.rank <= 2);
  const leaderDisplay = showInf(data.leaderInfluence);
  const gapDisplay =
    data.gapToLeader > 0
      ? showInf(data.gapToLeader)
      : data.contestGap != null
        ? showInf(data.contestGap)
        : null;

  return (
    <div className={`cell-popup cell-popup--informative${data.contested ? ' cell-popup-contested' : ''}`}>
      <header className="cell-popup-header">
        <div className="cell-popup-header__text">
          <h3 className="cell-popup-title">{action.headline}</h3>
          <p className="cell-popup-subtitle">{action.subtitle}</p>
        </div>
        <div className="cell-popup-badges">
          {data.contested && <span className="cell-popup-badge cell-popup-badge--contest">Спор</span>}
          {data.myInfluence > 0 && (
            <span className={`cell-popup-badge ${freshnessBadgeClass(freshness)}`}>
              {freshnessLabel(freshness)}
            </span>
          )}
          {data.myInfluence <= 0 && !data.contested && !cell.ownerNickname && (
            <span className="cell-popup-badge">Свободна</span>
          )}
        </div>
      </header>

      <div className={`cell-popup-action cell-popup-action--${action.tone}`}>
        <p>{action.action}</p>
      </div>

      <div
        className={`cell-popup-metrics${
          myDisplay != null && !showOpponentMetric ? ' cell-popup-metrics--solo' : ''
        }`}
      >
        {myDisplay != null ? (
          <>
            <div className="cell-popup-metric cell-popup-metric--primary">
              <span className="cell-popup-metric-value">{myDisplay}</span>
              <span className="cell-popup-metric-label">ваша сила</span>
            </div>
            {showOpponentMetric && (
              <>
                <div className="cell-popup-metric-divider" aria-hidden="true" />
                <div className="cell-popup-metric cell-popup-metric--secondary">
                  <span className="cell-popup-metric-value cell-popup-metric-value--sub">
                    {opponent ? showInf(opponent.influence) : leaderDisplay}
                  </span>
                  <span className="cell-popup-metric-label">
                    {opponent ? opponent.nickname : cell.ownerNickname ? `у ${cell.ownerNickname}` : 'лидер'}
                  </span>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="cell-popup-metric cell-popup-metric--primary">
              <span className="cell-popup-metric-value">{leaderDisplay}</span>
              <span className="cell-popup-metric-label">
                {cell.ownerNickname ? `у ${cell.ownerNickname}` : 'лидер'}
              </span>
            </div>
            {gapDisplay != null && (
              <>
                <div className="cell-popup-metric-divider" aria-hidden="true" />
                <div className="cell-popup-metric cell-popup-metric--secondary">
                  <span className="cell-popup-metric-value cell-popup-metric-value--sub">+{gapDisplay}</span>
                  <span className="cell-popup-metric-label">до захвата</span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {data.myInfluence > 0 && (
        <div className="cell-popup-visit">
          <div className="cell-popup-visit__row">
            <span className="cell-popup-visit__label">Удержание следа</span>
            {lastVisitLabel ? (
              <span className="cell-popup-visit__when">Последняя пробежка: {lastVisitLabel}</span>
            ) : null}
            <span className="cell-popup-visit__caption">{visitCaption}</span>
          </div>
          <span
            className={`cell-popup-visit-bar cell-popup-visit-bar--${freshness}`}
            role="progressbar"
            aria-valuenow={visitBarPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${visitBarPct}%` }} />
          </span>
        </div>
      )}

      {hasPlayers && (
        <section className="cell-popup-players">
          <h4 className="cell-popup-section-title">
            {data.isOwner || data.myInfluence > 0 ? 'Соперники в клетке' : 'Игроки в клетке'}
          </h4>
          <ol className="cell-popup-leaderboard">
            {data.players.slice(0, 4).map((player) => (
              <li key={player.userId} className={player.isMe ? 'is-me' : undefined}>
                <span>
                  {player.rank}. {player.nickname}
                  {player.isMe ? ' (вы)' : ''}
                </span>
                <strong>{showInf(player.influence)}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(hasHistory || data.myInfluence > 0) && (
        <>
          <button
            type="button"
            className="cell-popup-expand"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
          >
            {detailsOpen ? 'Скрыть детали' : 'История и правила ослабления'}
          </button>

          {detailsOpen && (
            <div className="cell-popup-drawer">
              {data.myInfluence > 0 && (
                <section className="cell-popup-drawer-section">
                  <h4 className="cell-popup-drawer-title">Ослабление следа</h4>
                  <p className="cell-popup-drawer-note">
                    {DECAY_GRACE_DAYS} дней после визита влияние не падает, затем −{DECAY_PERCENT_PER_DAY}% от
                    текущего в день. Через {DECAY_DELETE_AFTER_DAYS} дней без визита след исчезает.
                  </p>
                </section>
              )}

              {hasHistory && (
                <section className="cell-popup-drawer-section">
                  <h4 className="cell-popup-drawer-title">История</h4>
                  <ul className="cell-popup-history-list">
                    {data.history.slice(0, 5).map((entry, index) => (
                      <li key={`${entry.changedAt}-${index}`}>
                        <span>
                          {entry.fromNickname ? `${entry.fromNickname} → ` : ''}
                          {entry.toNickname}
                        </span>
                        <time>{new Date(entry.changedAt).toLocaleDateString('ru-RU')}</time>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
