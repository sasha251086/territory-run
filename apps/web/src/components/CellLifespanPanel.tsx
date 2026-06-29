import {
  daysAgoShort,
  formatInfluenceValue,
  type FreshnessStatus,
} from '../utils/cell-lifespan';

type CellLifespanProps = {
  myInfluence: number;
  daysSinceMyActivity?: number | null;
  freshness?: FreshnessStatus;
  visitBarPct: number;
  visitBarLabel: string;
};

export default function CellLifespanPanel({
  myInfluence,
  daysSinceMyActivity,
  freshness = 'fresh',
  visitBarPct,
  visitBarLabel,
}: CellLifespanProps) {
  if (myInfluence <= 0) {
    return null;
  }

  return (
    <div className="cell-popup-summary">
      <div className="cell-popup-metrics">
        <div className="cell-popup-metric cell-popup-metric--primary">
          <span className="cell-popup-metric-value">{formatInfluenceValue(myInfluence)}</span>
          <span className="cell-popup-metric-label">сила клетки (0–100)</span>
        </div>
        <div className="cell-popup-metric-divider" aria-hidden="true" />
        <div className="cell-popup-metric cell-popup-metric--secondary">
          <span className="cell-popup-metric-value cell-popup-metric-value--sub">
            {daysAgoShort(daysSinceMyActivity)}
          </span>
          <span className="cell-popup-metric-label">с визита</span>
        </div>
      </div>

      <div
        className={`cell-popup-visit-bar cell-popup-visit-bar--${freshness}`}
        role="progressbar"
        aria-valuenow={visitBarPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={visitBarLabel}
      >
        <span style={{ width: `${visitBarPct}%` }} />
      </div>
    </div>
  );
}
