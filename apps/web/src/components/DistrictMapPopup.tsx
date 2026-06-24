import type { DistrictProgress } from '../api/types';

export default function DistrictMapPopup({
  progress,
  onClose,
}: {
  progress: DistrictProgress;
  onClose: () => void;
}) {
  const threshold = progress.kingThresholdPercent;
  const barWidth = Math.min(100, Math.round((progress.myControlPercent / threshold) * 100));

  return (
    <div className="map-district-popup">
      <div className="map-district-popup__head">
        <h3>Район: {progress.districtName}</h3>
        <button type="button" className="map-district-popup__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      <p>
        Король:{' '}
        {progress.king?.nickname ?? 'Нет короля'}
        {progress.isKing ? ' (вы)' : ''}
      </p>
      {progress.myControlPercent > 0 && (
        <>
          <p>
            Ваш контроль: {progress.myControlPercent}% из {threshold}% для захвата
          </p>
          <div className="map-district-popup__bar" aria-hidden="true">
            <span style={{ width: `${barWidth}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
