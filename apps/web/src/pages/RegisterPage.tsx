import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">LOGO</div>
        <h1>Territory Run</h1>
        <p className="auth-subtitle">Захвати свой город</p>

        <div className="auth-tabs">
          <Link to="/login">Вход</Link>
          <span className="active">Регистрация</span>
        </div>

        <form className="stack" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Никнейм
            <input
              type="text"
              autoComplete="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          </label>
          <label>
            Пароль
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </label>
          {error && <p className="error-banner">{error}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Создание…' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}
