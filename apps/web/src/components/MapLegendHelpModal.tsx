export default function MapLegendHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="celebration-overlay" role="dialog" aria-label="Как читать карту">
      <div className="celebration-card map-guide-card">
        <p className="eyebrow">Карта</p>
        <h2>Как читать клетки</h2>
        <ul className="map-guide-list">
          <li>
            <span className="map-guide-swatch map-guide-swatch--own" />{' '}
            <strong>Зелёная</strong> — вы лидируете. <strong>Красная</strong> — соперник.
          </li>
          <li>
            <span className="map-guide-swatch map-guide-swatch--split" />{' '}
            <strong>Два цвета</strong> — спорная клетка (50/50). Точные цифры — в подписи.
          </li>
          <li>
            <span className="map-guide-swatch map-guide-swatch--num">78</span> Цифра — ваше
            влияние в клетке (0–100).
          </li>
          <li>
            <span className="map-guide-swatch map-guide-swatch--dash" /> Пунктир — давно не
            бегали (−2% в день).
          </li>
        </ul>
        <button type="button" className="primary-btn" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}
