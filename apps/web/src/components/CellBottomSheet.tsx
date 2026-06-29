import { useEffect, useRef } from 'react';
import CellPopupContent from './CellPopup';
import type { MapCell } from '../api/types';

export default function CellBottomSheet({
  cell,
  onClose,
}: {
  cell: MapCell | null;
  onClose: () => void;
}) {
  const touchStartY = useRef(0);

  useEffect(() => {
    if (!cell) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cell, onClose]);

  if (!cell) {
    return null;
  }

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose} role="presentation">
      <section
        className="bottom-sheet"
        role="dialog"
        aria-label="Информация о клетке"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          const delta = e.changedTouches[0].clientY - touchStartY.current;
          if (delta > 60) {
            onClose();
          }
        }}
      >
        <div className="bottom-sheet-handle" aria-hidden="true" />
        <CellPopupContent cell={cell} />
      </section>
    </div>
  );
}
