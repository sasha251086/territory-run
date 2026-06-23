import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Карта', end: true, icon: 'map' },
  { to: '/activities', label: 'Пробежки', icon: 'runs' },
  { to: '/leaderboard', label: 'Рейтинг', icon: 'rank' },
  { to: '/feed', label: 'Лента', icon: 'feed' },
  { to: '/profile', label: 'Профиль', icon: 'profile' },
] as const;

function NavIcon({ name }: { name: (typeof links)[number]['icon'] }) {
  switch (name) {
    case 'map':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6.5 9 4l6 2.5 6-2.5v13l-6 2.5-6-2.5-6 2.5V6.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 4v13M15 6.5v13" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'runs':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7 21l3-7 4 1 3-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'rank':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 17h10M8 17V9l4-3 4 3v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'feed':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14M5 12h10M5 17h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'profile':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 20c1.6-3 4.2-4.5 7-4.5s5.4 1.5 7 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

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

      <nav className={`app-nav${isMapRoute ? ' app-nav-map' : ''}`}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <NavIcon name={link.icon} />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
