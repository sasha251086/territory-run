import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { HOME_ZONE_RADIUS_M, HOME_ZONE_BONUS_MULTIPLIER } from '../constants/game';

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
        pathOptions={{ color: '#1A1A1A', fillColor: '#C8C8C8', fillOpacity: 1 }}
      />
      <Circle
        center={position}
        radius={HOME_ZONE_RADIUS_M}
        pathOptions={{ color: '#8A8A8A', fillColor: '#E5E5E5', fillOpacity: 0.35, dashArray: '6 4' }}
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
    const isFirstSetup = user?.homeLat == null || user?.homeLng == null;
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ homeLat: position[0], homeLng: position[1] }),
      });
      await refreshProfile();
      if (isFirstSetup) {
        navigate('/', { replace: true, state: { welcome: true } });
      } else {
        navigate('/profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить домашнюю базу');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ width: 'min(100%, 440px)' }}>
        <h1>{user?.homeLat != null ? 'Новая база' : 'Выберите базу'}</h1>
        <p className="auth-subtitle">
          Нажмите на карту — в радиусе {HOME_ZONE_RADIUS_M} м действует бонус ×
          {HOME_ZONE_BONUS_MULTIPLIER} к влиянию.
        </p>

        <div className="onboarding-map">
          <MapContainer
            center={position}
            zoom={14}
            zoomControl={false}
            attributionControl={false}
            className="leaflet-map"
            style={{ height: '100%' }}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            <HomePicker position={position} onPick={(lat, lng) => setPosition([lat, lng])} />
          </MapContainer>
        </div>

        {error && <p className="error-banner">{error}</p>}
        <button type="button" className="primary-btn" onClick={saveHome} disabled={loading}>
          {loading ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
