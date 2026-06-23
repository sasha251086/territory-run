import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Карта', end: true },
  { to: '/activities', label: 'Пробежки' },
  { to: '/leaderboard', label: 'Рейтинг' },
  { to: '/feed', label: 'Лента' },
  { to: '/profile', label: 'Профиль' },
];

export default function AppLayout({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const influence = Math.round(user?.stats?.totalInfluence ?? 0);
  const isMapRoute = location.pathname === '/';

  return (
    <div className={isMapRoute ? 'app-shell map-shell' : 'app-shell'}>
      {!isMapRoute && (
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
      )}

      <main className="app-main">{children ?? <Outlet />}</main>

      {!isMapRoute && (
        <nav className="app-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
