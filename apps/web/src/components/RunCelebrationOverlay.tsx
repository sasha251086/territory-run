import HexConfetti from './HexConfetti';
import { formatCellsArea } from '../utils/territory';

export type CelebrationStat = {
  value: string;
  label: string;
};

export default function RunCelebrationOverlay({
  cellsOwned,
  headline,
  message,
  stats,
  onDismiss,
  onShare,
}: {
  cellsOwned: number;
  headline?: string;
  message: string;
  stats?: CelebrationStat[];
  onDismiss: () => void;
  onShare?: () => void;
}) {
  const title = headline ?? 'Территория расширена!';

  return (
    <div className="celebration-overlay" role="dialog" aria-label="Результат пробежки">
      <HexConfetti />
      <div className="celebration-card">
        <p className="eyebrow">Отличная пробежка!</p>
        <h2>{title}</h2>
        {stats && stats.length > 0 ? (
          <div className="celebration-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="celebration-stat">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="celebration-message">{message}</p>
        )}
        {stats && stats.length > 0 && (
          <p className="celebration-message muted small">{message}</p>
        )}
        <p className="celebration-area">{formatCellsArea(cellsOwned)}</p>
        <div className="celebration-actions">
          {onShare && (
            <button type="button" className="ghost-btn" onClick={onShare}>
              Поделиться
            </button>
          )}
          <button type="button" className="primary-btn" onClick={onDismiss}>
            На карту →
          </button>
        </div>
      </div>
    </div>
  );
}
