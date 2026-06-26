import {
  DECAY_DELETE_AFTER_DAYS,
  MAX_INFLUENCE_GAIN_MULTIPLIER,
  SOFT_CAP_CELLS,
} from '../constants/game';

export default function GameTutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="celebration-overlay" role="dialog" aria-label="Как играть">
      <div className="celebration-card game-tutorial-card">
        <p className="eyebrow">Territory Run</p>
        <h2>Как работает игра</h2>
        <ol className="game-tutorial-list">
          <li>
            <strong>Влияние.</strong> Пробежка по клетке даёт до +1 влияния (макс. 100). Чем
            больше метров внутри клетки — тем полнее бонус. Владелец = игрок с максимальным
            влиянием.
          </li>
          <li>
            <strong>Бонусы.</strong> Домашняя зона ×1.25, стрик до ×1.3, новичок ×1.25. Общий
            потолок множителей — ×{MAX_INFLUENCE_GAIN_MULTIPLIER} за один проход по клетке.
          </li>
          <li>
            <strong>Soft cap.</strong> После {SOFT_CAP_CELLS} клеток прирост влияния снижается
            до ×0.5 — территорию можно держать, но расширяться сложнее.
          </li>
          <li>
            <strong>Затухание.</strong> Без пробежек влияние падает на 2% в день. После{' '}
            {DECAY_DELETE_AFTER_DAYS} дней без активности клетка обнуляется.
          </li>
          <li>
            <strong>Миссии на карте.</strong> Полоска «Миссии» и кнопка «Цели» подскажут:{' '}
            <em>защитить</em> свою клетку, <em>добить</em> захват, <em>захватить</em> у соперника
            или <em>расширить</em> границу на нейтральные клетки.
          </li>
          <li>
            <strong>Лента.</strong> Одна запись на пробежку — без спама по каждой клетке. Осады
            показывают, когда соперник близок к захвату (&gt;80% вашего влияния).
          </li>
        </ol>
        <button type="button" className="primary-btn" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}
