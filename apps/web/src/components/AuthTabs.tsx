import { Link, useLocation } from 'react-router-dom';

export default function AuthTabs() {
  const { pathname } = useLocation();
  const isLogin = pathname === '/login';

  return (
    <div className="tr-auth-tabs" role="tablist" aria-label="Вход или регистрация">
      <Link
        to="/login"
        role="tab"
        aria-selected={isLogin}
        className={`tr-auth-tabs__item${isLogin ? ' tr-auth-tabs__item--active' : ''}`}
      >
        Вход
      </Link>
      <Link
        to="/register"
        role="tab"
        aria-selected={!isLogin}
        className={`tr-auth-tabs__item${!isLogin ? ' tr-auth-tabs__item--active' : ''}`}
      >
        Регистрация
      </Link>
    </div>
  );
}
