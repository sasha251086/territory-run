import { streakDisplay } from '../utils/streak-display';

export default function StreakBadge({
  streak,
  compact = false,
}: {
  streak: number;
  compact?: boolean;
}) {
  if (streak <= 0) {
    return null;
  }

  const info = streakDisplay(streak);

  return (
    <span
      className={`streak-badge streak-badge--${info.tier}${compact ? ' streak-badge--compact' : ''}`}
      title={`${info.title} · влияние ${info.bonusLabel}`}
    >
      {info.emoji && <span className="streak-badge__emoji" aria-hidden="true">{info.emoji}</span>}
      <span className="streak-badge__days">{streak} дн</span>
      {!compact && info.tier !== 'none' && (
        <span className="streak-badge__mult">×{info.multiplier.toFixed(1)}</span>
      )}
    </span>
  );
}
