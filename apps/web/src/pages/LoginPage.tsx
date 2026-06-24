import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthTabs from '../components/AuthTabs';
import TrLogo from '../components/TrLogo';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tr-auth-screen tr-app">
      <div className="tr-auth-card tr-glass">
        <TrLogo />
        <AuthTabs />
        <form className="stack" onSubmit={handleSubmit}>
          <input
            className="tr-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="tr-input"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="error-banner">{error}</p>}
          <button type="submit" className="tr-btn tr-btn-primary" disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
        <div className="tr-auth-divider">или</div>
        <button type="button" className="tr-btn-strava" onClick={() => navigate('/register')}>
          Продолжить через Strava
        </button>
        <p className="tr-auth-footer">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
}
