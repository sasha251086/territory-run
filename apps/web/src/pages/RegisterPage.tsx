import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
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
      <div className="auth-card wide">
        <p className="eyebrow">Territory Run</p>
        <h1>Регистрация</h1>

        <section className="onboarding-copy">
          <p>Бегай и захватывай территории на карте города.</p>
          <p>Защищай свой район и домашнюю базу.</p>
          <p>Стань королём района, контролируя большую часть клеток.</p>
        </section>

        <form className="stack" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Никнейм
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
          </label>
          <label>
            Пароль
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </label>
          {error && <p className="error-banner">{error}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Создание...' : 'Создать аккаунт'}
          </button>
        </form>
        <p className="muted">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}
