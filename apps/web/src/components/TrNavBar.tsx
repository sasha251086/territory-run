import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Карта', end: true, icon: '◆' },
  { to: '/activities', label: 'Бег', icon: '▲' },
  { to: '/leaderboard', label: 'Рейтинг', icon: '◎' },
  { to: '/feed', label: 'Лента', icon: '◆' },
  { to: '/profile', label: 'Профиль', icon: '◎' },
] as const;

export default function TrNavBar() {
  return (
    <nav className="tr-navbar app-nav" aria-label="Основная навигация">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={'end' in link ? link.end : false}
          className={({ isActive }) =>
            `tr-navbar__item${isActive ? ' tr-navbar__item--active' : ''}`
          }
        >
          <span className="tr-navbar__icon" aria-hidden="true">
            {link.icon}
          </span>
          <span className="tr-navbar__label">{link.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
