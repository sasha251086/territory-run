import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';

function HomePicker({
  position,
  onPick,
}: {
  position: [number, number];
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return (
    <>
      <CircleMarker
        center={position}
        radius={8}
        pathOptions={{ color: '#1a5f4a', fillColor: '#22c55e', fillOpacity: 1 }}
      />
      <Circle
        center={position}
        radius={500}
        pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.2 }}
      />
    </>
  );
}

export default function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [position, setPosition] = useState<[number, number]>(() => {
    if (user?.homeLat != null && user?.homeLng != null) {
      return [user.homeLat, user.homeLng];
    }
    return [56.9496, 24.1052];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveHome() {
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ homeLat: position[0], homeLng: position[1] }),
      });
      await refreshProfile();
      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить домашнюю базу');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <p className="eyebrow">
          {user?.homeLat != null ? 'Домашняя база' : 'Шаг 2 из 2'}
        </p>
        <h1>{user?.homeLat != null ? 'Изменить домашнюю базу' : 'Выберите домашнюю базу'}</h1>
        <p className="muted">
          Нажмите на карту, чтобы указать дом. В радиусе 500 м действует бонус к влиянию.
        </p>

        <div className="map-frame onboarding-map">
          <MapContainer center={position} zoom={14} className="leaflet-map">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <HomePicker position={position} onPick={(lat, lng) => setPosition([lat, lng])} />
          </MapContainer>
        </div>

        <p className="muted small">
          После сохранения подключите Strava в профиле — это ключевой шаг, чтобы начать захватывать территории.
        </p>

        {error && <p className="error-banner">{error}</p>}
        <button type="button" className="primary-btn" onClick={saveHome} disabled={loading}>
          {loading ? 'Сохранение...' : user?.homeLat != null ? 'Сохранить новую базу' : 'Сохранить и перейти в профиль'}
        </button>
      </div>
    </div>
  );
}
