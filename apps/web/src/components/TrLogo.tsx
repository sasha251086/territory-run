type TrLogoProps = {
  compact?: boolean;
};

export default function TrLogo({ compact = false }: TrLogoProps) {
  return (
    <div className={`tr-logo${compact ? ' tr-logo--compact' : ''}`}>
      <div className="tr-logo__icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M24 4L42 14v20L24 44 6 34V14L24 4z"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <path d="M20 16l12 8-12 8V16z" fill="currentColor" />
        </svg>
      </div>
      {!compact && (
        <div className="tr-logo__text">
          <span className="tr-logo__title tr-logo__title--accent">Territory</span>
          <span className="tr-logo__title">Run</span>
          <span className="tr-logo__tagline">Беги. Захватывай. Владей.</span>
        </div>
      )}
    </div>
  );
}
