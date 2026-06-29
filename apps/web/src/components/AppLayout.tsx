import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ApiSlowLoadingBanner from './ApiSlowLoadingBanner';

const links = [
  {
    to: '/',
    label: 'Карта',
    end: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2 2 7v2h20V7L12 2zm8 10H4v8h16v-8zM6 18v-4h4v4H6zm6 0v-4h4v4h-4z"
        />
      </svg>
    ),
  },
  {
    to: '/activities',
    label: 'Бег',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"
        />
      </svg>
    ),
  },
  {
    to: '/leaderboard',
    label: 'Рейтинг',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M16 11V3H8v8H2v10h20V11h-6zm-8 8H4v-6h4v6zm6 0h-4v-6h4v6zm6 0h-4v-6h4v6z" />
      </svg>
    ),
  },
  {
    to: '/feed',
    label: 'Лента',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Профиль',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"
        />
      </svg>
    ),
  },
] as const;

export default function AppLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const isMapRoute = location.pathname === '/';

  return (
    <div className={`app-shell game-shell${isMapRoute ? ' map-shell' : ''}`}>
      <ApiSlowLoadingBanner />
      <main className="app-main">{children ?? <Outlet />}</main>

      <nav className="app-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={'end' in link ? link.end : false}
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link--with-icon active' : 'nav-link nav-link--with-icon'
            }
          >
            <span className="nav-link__icon">{link.icon}</span>
            <span className="nav-link__label">{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
