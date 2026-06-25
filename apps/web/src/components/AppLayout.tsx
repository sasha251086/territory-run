import { NavLink, Outlet, useLocation } from 'react-router-dom';

const links = [
  { to: '/', label: 'Карта', end: true },
  { to: '/activities', label: 'Бег' },
  { to: '/leaderboard', label: 'Рейтинг' },
  { to: '/feed', label: 'Лента' },
  { to: '/profile', label: 'Профиль' },
] as const;

export default function AppLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const isMapRoute = location.pathname === '/';

  return (
    <div className={isMapRoute ? 'app-shell map-shell' : 'app-shell'}>
      <main className="app-main">{children ?? <Outlet />}</main>

      <nav className="app-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={'end' in link ? link.end : false}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
