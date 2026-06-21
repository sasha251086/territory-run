import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Circle,
  useMap,
  useMapEvents,
  Popup,
} from 'react-leaflet';
import { cellToBoundary } from 'h3-js';
import type { LatLngBounds, LatLngExpression } from 'leaflet';
import L from 'leaflet';
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

function FlyToCells({ targets, trigger }: { targets: LatLngExpression[]; trigger: number }) {
  const map = useMap();

  useEffect(() => {
    if (trigger <= 0 || targets.length === 0) {
      return;
    }
    map.fitBounds(L.latLngBounds(targets), { padding: [32, 32], maxZoom: 15 });
  }, [map, targets, trigger]);

  return null;
}

function cellColor(cell: MapCell, currentUserId: string | undefined) {
  if (!cell.ownerId) return '#94a3b8';
  if (cell.ownerId === currentUserId) return '#22c55e';
  return '#3b82f6';
}

function mergeCells(primary: MapCell[], secondary: MapCell[]) {
  const byId = new Map<string, MapCell>();
  for (const cell of primary) {
    byId.set(cell.h3Index, cell);
  }
  for (const cell of secondary) {
    byId.set(cell.h3Index, cell);
  }
  return Array.from(byId.values());
}

export default function MapPage() {
  const { user } = useAuth();
  const [nearbyCells, setNearbyCells] = useState<MapCell[]>([]);
  const [myCells, setMyCells] = useState<MapCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flyTrigger, setFlyTrigger] = useState(0);

  const defaultCenter = useMemo<[number, number]>(() => {
    if (user?.homeLat != null && user.homeLng != null) {
      return [user.homeLat, user.homeLng];
    }
    return [56.9496, 24.1052];
  }, [user?.homeLat, user?.homeLng]);

  const loadMyCells = useCallback(async () => {
    try {
      const data = await apiRequest<{ cells: MapCell[] }>('/map/cells/mine');
      setMyCells(data.cells);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить ваши клетки');
    }
  }, []);

  const loadNearbyCells = useCallback(async (bounds: LatLngBounds) => {
    setLoading(true);
    setError(null);
    try {
      const query = boundsToQuery(bounds);
      const data = await apiRequest<{ cells: MapCell[] }>(`/map/cells?${query.toString()}`);
      setNearbyCells(data.cells);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить карту');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMyCells();
  }, [loadMyCells, user?.stats?.cellsOwned]);

  const displayCells = useMemo(
    () => mergeCells(myCells, nearbyCells),
    [myCells, nearbyCells],
  );

  const flyTargets = useMemo(
    () =>
      myCells
        .filter((cell) => cell.lat != null && cell.lng != null)
        .map((cell) => [cell.lat as number, cell.lng as number] as LatLngExpression),
    [myCells],
  );

  const cellsFarFromHome =
    user?.homeLat != null &&
    user.homeLng != null &&
    myCells.length > 0 &&
    myCells.every((cell) => {
      if (cell.lat == null || cell.lng == null) {
        return true;
      }
      const dLat = Math.abs(cell.lat - user.homeLat!);
      const dLng = Math.abs(cell.lng - user.homeLng!);
      return dLat > 0.05 || dLng > 0.05;
    });

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

      {cellsFarFromHome && (
        <p className="info-box">
          Ваши клетки от пробежки в другом районе. Нажмите «Показать мои клетки», чтобы перейти к ним на карте.
        </p>
      )}

      {myCells.length > 0 && (
        <button
          type="button"
          className="primary-btn map-action-btn"
          onClick={() => setFlyTrigger((value) => value + 1)}
        >
          Показать мои клетки
        </button>
      )}

      {error && <p className="error-banner">{error}</p>}

      <div className="map-frame">
        <MapContainer
          key={`${defaultCenter[0]}-${defaultCenter[1]}`}
          center={defaultCenter}
          zoom={13}
          className="leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onMove={loadNearbyCells} />
          <FlyToCells targets={flyTargets} trigger={flyTrigger} />

          {user?.homeLat != null && user.homeLng != null && (
            <Circle
              center={[user.homeLat, user.homeLng]}
              radius={500}
              pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.15 }}
            />
          )}

          {displayCells.map((cell) => {
            try {
              const boundary = cellToBoundary(cell.h3Index).map(
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
