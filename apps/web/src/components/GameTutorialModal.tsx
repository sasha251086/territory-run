import { useState } from 'react';
import {
  DECAY_DELETE_AFTER_DAYS,
  DECAY_GRACE_DAYS,
  DECAY_PERCENT_PER_DAY,
  MAX_INFLUENCE_DISPLAY,
  SOFT_CAP_CELLS,
} from '../constants/game';

const STEPS = [
  {
    title: 'Как читать карту',
    body: (
      <>
        <p>Зелёная клетка — вы лидируете, красная — соперник.</p>
        <p>
          Цифра на клетке — ваше влияние (0–{MAX_INFLUENCE_DISPLAY}). Чем больше, тем
          сложнее отобрать.
        </p>
        <p>Пунктирная обводка — давно не бегали, влияние ослабевает.</p>
      </>
    ),
  },
  {
    title: 'После пробежки',
    body: (
      <>
        <p>Каждый проход через клетку даёт +1 влияния (если пробежали ≥50 м внутри).</p>
        <p>Владелец клетки — игрок с максимальным влиянием. Обогнали соперника — захватили.</p>
        <p>Домашняя зона и стрик ускоряют рост влияния.</p>
      </>
    ),
  },
  {
    title: 'Защищай территорию',
    body: (
      <>
        <p>
          Первые {DECAY_GRACE_DAYS} дней без визита влияние не падает, затем −
          {DECAY_PERCENT_PER_DAY}% в день. Через {DECAY_DELETE_AFTER_DAYS} дней след исчезает.
        </p>
        <p>Если соперник набрал 80% вашего влияния — это осада. Бегите защищать клетку.</p>
        <p>После {SOFT_CAP_CELLS} клеток прирост ×0.5 — расширяйтесь осмысленно.</p>
      </>
    ),
  },
] as const;

export default function GameTutorialModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step >= STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      onClose();
      return;
    }
    setStep((value) => value + 1);
  }

  return (
    <div className="celebration-overlay" role="dialog" aria-label="Как играть">
      <div className="celebration-card game-tutorial-card">
        <p className="eyebrow">
          Territory Run · шаг {step + 1}/{STEPS.length}
        </p>
        <h2>{current.title}</h2>
        <div className="game-tutorial-steps">{current.body}</div>
        <div className="celebration-actions">
          {step > 0 && (
            <button type="button" className="ghost-btn" onClick={() => setStep((value) => value - 1)}>
              Назад
            </button>
          )}
          <button type="button" className="primary-btn" onClick={handleNext}>
            {isLast ? 'Понятно' : 'Далее'}
          </button>
        </div>
      </div>
    </div>
  );
}
