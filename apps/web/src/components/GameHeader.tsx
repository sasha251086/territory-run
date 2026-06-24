import { useAuth } from '../context/AuthContext';

type GameHeaderProps = {
  onLogout?: () => void;
};

export default function GameHeader({ onLogout }: GameHeaderProps) {
  const { user } = useAuth();
  const cells = user?.stats?.cellsOwned ?? 0;
  const influence = Math.round(user?.stats?.totalInfluence ?? 0);

  return (
    <header className="tr-game-header tr-glass">
      <div className="tr-game-header__brand">
        <span className="tr-game-header__eyebrow">Territory Run</span>
        <strong className="tr-game-header__title">{user?.nickname || 'Runner'}</strong>
      </div>
      <div className="tr-game-header__metrics" aria-label="Статистика игрока">
        <span className="tr-badge tr-badge--cyan">
          <strong>{cells}</strong> зон
        </span>
        <span className="tr-badge tr-badge--green">
          <strong>{influence}</strong> влияния
        </span>
      </div>
      {onLogout && (
        <button type="button" className="tr-btn tr-btn-ghost tr-game-header__logout" onClick={onLogout}>
          Выйти
        </button>
      )}
    </header>
  );
}
