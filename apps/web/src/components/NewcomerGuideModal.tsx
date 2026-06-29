import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { markHintSeen } from '../utils/first-time-hint';

const STEPS = [
  {
    title: 'База установлена',
    body: (
      <p>
        Домашняя зона на карте даёт бонус к силе клеток. Чем чаще бегаете рядом с домом, тем крепче
        территория.
      </p>
    ),
    nextLabel: 'Далее',
  },
  {
    title: 'Первая пробежка',
    body: (
      <p>
        Загрузите GPX-файл на вкладке <strong>Бег</strong> или подключите Strava в профиле. Без
        пробежки клетки не захватить.
      </p>
    ),
    nextLabel: 'К пробежкам',
    goTo: '/activities',
  },
  {
    title: 'Первая клетка',
    body: (
      <p>
        Пробегитесь через гекс на карте — он станет вашим. Зелёный цвет значит, что вы лидируете в
        клетке.
      </p>
    ),
    nextLabel: 'На карту',
  },
] as const;

export default function NewcomerGuideModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const isLast = step >= STEPS.length - 1;

  function finish() {
    markHintSeen('newcomer-guide');
    onClose();
  }

  function handleNext() {
    if ('goTo' in current && current.goTo) {
      markHintSeen('newcomer-guide');
      navigate(current.goTo);
      onClose();
      return;
    }
    if (isLast) {
      finish();
      return;
    }
    setStep((value) => value + 1);
  }

  return (
    <div className="celebration-overlay" role="dialog" aria-label="С чего начать">
      <div className="celebration-card game-tutorial-card newcomer-guide-card">
        <p className="eyebrow">
          Старт · шаг {step + 1}/{STEPS.length}
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
            {current.nextLabel}
          </button>
        </div>
        <button type="button" className="ghost-btn small-btn newcomer-guide-skip" onClick={finish}>
          Пропустить
        </button>
      </div>
    </div>
  );
}
