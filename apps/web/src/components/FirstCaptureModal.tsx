import { apiRequest } from '../api/client';

export default function FirstCaptureModal({
  cellsCaptured,
  onClose,
}: {
  cellsCaptured: number;
  onClose: () => void;
}) {
  async function handleClose() {
    try {
      await apiRequest('/users/me/first-capture-shown', { method: 'POST' });
    } finally {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <p className="eyebrow">Первая территория</p>
        <h2>Первая территория захвачена!</h2>
        <p>Вы захватили {cellsCaptured} клеток. Продолжайте бегать и расширяйте влияние на карте.</p>
        <button type="button" className="primary-btn" onClick={() => void handleClose()}>
          Отлично!
        </button>
      </div>
    </div>
  );
}
