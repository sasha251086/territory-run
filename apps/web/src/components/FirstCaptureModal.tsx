import { apiRequest } from '../api/client';
import { formatCellCount } from '../utils/territory';

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
        <h2>Первая территория!</h2>
        <p>Захвачено {formatCellCount(cellsCaptured)}. Продолжайте бегать и расширяйте влияние.</p>
        <button type="button" className="primary-btn" onClick={() => void handleClose()}>
          Отлично
        </button>
      </div>
    </div>
  );
}
