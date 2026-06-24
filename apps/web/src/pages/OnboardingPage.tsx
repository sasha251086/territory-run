import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { apiRequest } from '../api/client';
import { MAP_TILE } from '../utils/map-tiles';
import { useAuth } from '../context/AuthContext';

function MapDragPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useMapEvents({
    moveend() {
      const c = map.getCenter();
      onPick(c.lat, c.lng);
    },
  });
  return null;
}

export default function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const isEdit = user?.homeLat != null && user?.homeLng != null;
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
      navigate(isEdit ? '/profile' : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить базу');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tr-onboarding tr-app">
      <div className="tr-onboarding__map">
        <MapContainer center={position} zoom={15} className="leaflet-map">
          <TileLayer attribution={MAP_TILE.attribution} url={MAP_TILE.url} />
          <MapDragPicker onPick={(lat, lng) => setPosition([lat, lng])} />
          <Circle
            center={position}
            radius={500}
            pathOptions={{
              color: '#3ecfb8',
              fillColor: '#3ecfb8',
              fillOpacity: 0.06,
              weight: 2,
              dashArray: '8 6',
            }}
          />
        </MapContainer>
      </div>

      <div className="tr-onboarding__overlay">
        <header className="tr-onboarding__header">
          <h1>{isEdit ? 'Новая база' : 'Выбор базы'}</h1>
          <div className="tr-onboarding__steps" aria-label="Прогресс онбординга">
            <span className="tr-onboarding__step tr-onboarding__step--done" />
            <span className="tr-onboarding__step tr-onboarding__step--done" />
            <span className={`tr-onboarding__step${isEdit ? ' tr-onboarding__step--done' : ''}`} />
          </div>
        </header>

        <section className="tr-onboarding__hint tr-glass">
          <strong>Перетащите пин на дом или старт бега</strong>
          <span>Клетки в радиусе 500 м дают бонус ×1.5 влияния</span>
        </section>

        <div className="tr-onboarding__pin-wrap" aria-hidden="true">
          <div className="tr-onboarding__pin" />
        </div>

        <footer className="tr-onboarding__footer">
          <div className="tr-onboarding__coords">
            <span>
              <span className="tr-onboarding__coords-dot" /> {position[0].toFixed(4)}° N,{' '}
              {position[1].toFixed(4)}° E
            </span>
            <span>GPS</span>
          </div>
          {error && <p className="error-banner">{error}</p>}
          <button
            type="button"
            className="tr-btn tr-btn-primary"
            style={{ width: '100%' }}
            onClick={() => void saveHome()}
            disabled={loading}
          >
            {loading ? 'Сохранение…' : 'Подтвердить базу'}
          </button>
        </footer>
      </div>
    </div>
  );
}
