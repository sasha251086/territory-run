export default function RunCelebrationOverlay({
  title,
  subtitle,
  distanceKm,
  cellsGained,
  influenceGained,
  onDismiss,
  onShare,
}: {
  title?: string;
  subtitle?: string;
  distanceKm?: number;
  cellsGained?: number;
  influenceGained?: number;
  onDismiss: () => void;
  onShare?: () => void;
}) {
  return (
    <div className="tr-celebration" role="dialog" aria-label="Результат пробежки">
      <div className="tr-celebration__card tr-glass">
        <div className="tr-celebration__head">
          <div>
            <h2 className="tr-celebration__title">{title ?? 'Первый захват!'}</h2>
            <p className="tr-celebration__subtitle">
              {subtitle ?? 'Пробежка обработана успешно'}
            </p>
          </div>
          <button type="button" className="tr-celebration__close" onClick={onDismiss} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="tr-celebration__stats">
          {distanceKm != null && (
            <div className="tr-celebration__stat">
              <strong>{distanceKm.toFixed(1)} км</strong>
              <span>Дистанция</span>
            </div>
          )}
          {cellsGained != null && (
            <div className="tr-celebration__stat">
              <strong>{cellsGained}</strong>
              <span>Клеток</span>
            </div>
          )}
          {influenceGained != null && (
            <div className="tr-celebration__stat">
              <strong>+{Math.round(influenceGained)}</strong>
              <span>Влияние</span>
            </div>
          )}
        </div>

        <div className="tr-celebration__actions">
          <button type="button" className="tr-btn tr-btn-primary" onClick={onDismiss}>
            На карту!
          </button>
          {onShare && (
            <button type="button" className="tr-btn tr-btn-secondary" onClick={onShare}>
              Поделиться
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
