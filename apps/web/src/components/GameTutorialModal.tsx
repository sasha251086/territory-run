import { DECAY_DELETE_AFTER_DAYS } from '../constants/game';

export default function GameTutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="celebration-overlay" role="dialog" aria-label="Как играть">
      <div className="celebration-card game-tutorial-card">
        <p className="eyebrow">Territory Run</p>
        <h2>Как работает игра</h2>
        <ol className="game-tutorial-list">
          <li>
            <strong>Влияние.</strong> Пробежка по клетке даёт +1 влияния (до 100). Чем больше
            метров внутри клетки — тем полнее бонус. Владелец = игрок с максимальным влиянием.
          </li>
          <li>
            <strong>Затухание.</strong> Без пробежек влияние падает на 2% в день. После{' '}
            {DECAY_DELETE_AFTER_DAYS} дней без активности клетка обнуляется.
          </li>
          <li>
            <strong>Спорные клетки.</strong> Жёлтые зоны на карте — близкий отрыв с соперником.
            Кнопка «Цели» подскажет, что защитить, добить или захватить.
          </li>
        </ol>
        <button type="button" className="primary-btn" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}
