import { NavLink, Outlet } from 'react-router-dom';
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Territory Run</p>
          <h1>{user?.nickname}</h1>
        </div>
        <button type="button" className="ghost-btn" onClick={logout}>
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
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
