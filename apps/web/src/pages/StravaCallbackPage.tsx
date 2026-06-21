import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';

export default function StravaCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Подключаем Strava...');

  useEffect(() => {
    const code = params.get('code');
    if (!code) {
      setMessage('Код авторизации Strava не найден.');
      return;
    }

    async function complete() {
      try {
        await apiRequest('/integrations/strava/callback', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        setMessage('Strava успешно подключена!');
        setTimeout(() => navigate('/profile'), 1500);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Ошибка подключения Strava');
      }
    }

    void complete();
  }, [navigate, params]);

  return (
    <div className="page-center">
      <div className="auth-card">
        <h1>Strava</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}
