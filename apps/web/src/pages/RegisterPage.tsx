import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthTabs from '../components/AuthTabs';
import PasswordStrength from '../components/PasswordStrength';
import TrLogo from '../components/TrLogo';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(email, nickname, password);
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tr-auth-screen tr-app">
      <div className="tr-auth-card tr-glass">
        <TrLogo compact />
        <h1>Создать аккаунт</h1>
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
            type="text"
            placeholder="Никнейм в игре"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            autoComplete="username"
          />
          <input
            className="tr-input"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <PasswordStrength password={password} />
          <input
            className="tr-input"
            type="password"
            placeholder="Подтвердить пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          {error && <p className="error-banner">{error}</p>}
          <button type="submit" className="tr-btn tr-btn-primary" disabled={loading}>
            {loading ? 'Создание…' : 'Зарегистрироваться'}
          </button>
        </form>
        <p className="tr-auth-legal">
          Нажимая, вы принимаете <Link to="/privacy">условия</Link>
        </p>
        <p className="tr-auth-footer">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}
