import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Circle, useMapEvents, Popup } from 'react-leaflet';
import { cellToBoundary } from 'h3-js';
import type { LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiRequest } from '../api/client';
import type { MapCell } from '../api/types';
import { useAuth } from '../context/AuthContext';

function boundsToQuery(bounds: LatLngBounds) {
  return new URLSearchParams({
    north: bounds.getNorth().toFixed(6),
    south: bounds.getSouth().toFixed(6),
    east: bounds.getEast().toFixed(6),
    west: bounds.getWest().toFixed(6),
    limit: '500',
  });
}

function MapEvents({ onMove }: { onMove: (bounds: LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => onMove(map.getBounds()),
    zoomend: () => onMove(map.getBounds()),
    load: () => onMove(map.getBounds()),
  });
  return null;
}

function cellColor(cell: MapCell, currentUserId: string | undefined) {
  if (!cell.ownerId) return '#94a3b8';
  if (cell.ownerId === currentUserId) return '#22c55e';
  return '#3b82f6';
}

export default function MapPage() {
  const { user } = useAuth();
  const [cells, setCells] = useState<MapCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultCenter = useMemo<[number, number]>(() => {
    if (user?.homeLat != null && user.homeLng != null) {
      return [user.homeLat, user.homeLng];
    }
    return [56.9496, 24.1052];
  }, [user?.homeLat, user?.homeLng]);

  const loadCells = useCallback(async (bounds: LatLngBounds) => {
    setLoading(true);
    setError(null);
    try {
      const query = boundsToQuery(bounds);
      const data = await apiRequest<{ cells: MapCell[] }>(`/map/cells?${query.toString()}`);
      setCells(data.cells);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить карту');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="map-page">
      <section className="stats-strip">
        <div>
          <span>Клетки</span>
          <strong>{user?.stats?.cellsOwned ?? 0}</strong>
        </div>
        <div>
          <span>Влияние</span>
          <strong>{Math.round(user?.stats?.totalInfluence ?? 0)}</strong>
        </div>
        <div>
          <span>Пробежки</span>
          <strong>{user?.stats?.totalRuns ?? 0}</strong>
        </div>
      </section>

      {error && <p className="error-banner">{error}</p>}

      <div className="map-frame">
        <MapContainer center={defaultCenter} zoom={13} className="leaflet-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onMove={loadCells} />

          {user?.homeLat != null && user.homeLng != null && (
            <Circle
              center={[user.homeLat, user.homeLng]}
              radius={500}
              pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.15 }}
            />
          )}

          {cells.map((cell) => {
            try {
              const boundary = cellToBoundary(cell.h3Index, true).map(
                ([lat, lng]) => [lat, lng] as [number, number],
              );
              return (
                <Polygon
                  key={cell.h3Index}
                  positions={boundary}
                  pathOptions={{
                    color: cellColor(cell, user?.id),
                    fillColor: cellColor(cell, user?.id),
                    fillOpacity: 0.45,
                    weight: 1,
                  }}
                >
                  <Popup>
                    <strong>{cell.ownerNickname || 'Свободна'}</strong>
                    <br />
                    Влияние: {cell.influence}
                  </Popup>
                </Polygon>
              );
            } catch {
              return null;
            }
          })}
        </MapContainer>
        {loading && <div className="map-overlay">Обновление карты...</div>}
      </div>
    </div>
  );
}
