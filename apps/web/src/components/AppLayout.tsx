import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Карта', short: 'MAP', end: true },
  { to: '/activities', label: 'Пробежки', short: 'RUN' },
  { to: '/leaderboard', label: 'Рейтинг', short: 'TOP' },
  { to: '/feed', label: 'Лента', short: 'LOG' },
  { to: '/profile', label: 'Профиль', short: 'ME' },
];

export default function AppLayout({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const influence = Math.round(user?.stats?.totalInfluence ?? 0);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <p className="eyebrow">Territory Run</p>
          <h1>{user?.nickname || 'Runner'}</h1>
        </div>
        <div className="hud-metrics" aria-label="Статистика игрока">
          <span><strong>{user?.stats?.cellsOwned ?? 0}</strong> зон</span>
          <span><strong>{influence}</strong> влияния</span>
        </div>
        <button type="button" className="menu-btn" onClick={logout} aria-label="Выйти">
          Выйти
        </button>
      </header>

      <main className="app-main">{children ?? <Outlet />}</main>

      <nav className="app-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <span>{link.short}</span>
            <small>{link.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
