import { formatCellsArea } from '../utils/territory';

export default function RunCelebrationOverlay({
  cellsOwned,
  message,
  onDismiss,
  onShare,
}: {
  cellsOwned: number;
  message: string;
  onDismiss: () => void;
  onShare?: () => void;
}) {
  return (
    <div className="celebration-overlay" role="dialog" aria-label="Результат пробежки">
      <div className="celebration-burst" aria-hidden="true" />
      <div className="celebration-card">
        <p className="eyebrow">Territory captured</p>
        <h2>Территория расширена!</h2>
        <p className="celebration-message">{message}</p>
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
