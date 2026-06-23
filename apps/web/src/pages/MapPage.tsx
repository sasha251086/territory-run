import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Circle,
  CircleMarker,
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

function MapOverlayControls({
  canFocusMine,
  onFocusMine,
}: {
  canFocusMine: boolean;
  onFocusMine: () => void;
}) {
  const map = useMap();

  return (
    <>
      <div className="map-zoom-controls" aria-label="Масштаб карты">
        <button type="button" aria-label="Увеличить" onClick={() => map.zoomIn()}>
          +
        </button>
        <button type="button" aria-label="Уменьшить" onClick={() => map.zoomOut()}>
          −
        </button>
        <button
          type="button"
          aria-label="К моей территории"
          onClick={onFocusMine}
          disabled={!canFocusMine}
        >
          ⌖
        </button>
      </div>

      <div className="map-tools" aria-label="Инструменты карты">
        <button
          type="button"
          className="map-tool-btn"
          onClick={onFocusMine}
          disabled={!canFocusMine}
          aria-label="Показать мои клетки"
        >
          ◎
        </button>
      </div>
    </>
  );
}

function cellColor(cell: MapCell, currentUserId: string | undefined) {
  if (!cell.ownerId) return '#c6d3df';
  if (cell.ownerId === currentUserId) return '#45c8e7';
  return '#9b6dff';
}

function seededNoise(seed: string, index: number) {
  let hash = 2166136261;
  const input = `${seed}:${index}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function organicBoundary(cell: MapCell) {
  const boundary = cellToBoundary(cell.h3Index).map(([lat, lng]) => [lat, lng] as [number, number]);
  const centerLat = boundary.reduce((sum, point) => sum + point[0], 0) / boundary.length;
  const centerLng = boundary.reduce((sum, point) => sum + point[1], 0) / boundary.length;

  return boundary.map(([lat, lng], index) => {
    const radial = 0.9 + seededNoise(cell.h3Index, index) * 0.18;
    const skewLat = (seededNoise(cell.h3Index, index + 11) - 0.5) * 0.00008;
    const skewLng = (seededNoise(cell.h3Index, index + 23) - 0.5) * 0.00008;

    return [
      centerLat + (lat - centerLat) * radial + skewLat,
      centerLng + (lng - centerLng) * radial + skewLng,
    ] as [number, number];
  });
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

  const totalInfluence = Math.round(user?.stats?.totalInfluence ?? 0);
  const cellsOwned = user?.stats?.cellsOwned ?? 0;
  const totalRuns = user?.stats?.totalRuns ?? 0;
  const level = Math.max(1, Math.floor(cellsOwned / 12) + 1);

  return (
    <div className="map-page game-map-page">
      <section className="map-profile-card">
        <div className="map-brand-row">
          <p className="eyebrow">Territory Run</p>
          <div className="level-ring">{level}</div>
        </div>

        <div className="map-user-row">
          <div className="runner-avatar" aria-hidden="true">●</div>
          <h1>{user?.nickname || 'runner'}</h1>
        </div>

        <div className="map-stat-cards">
          <div className="map-stat-card stat-cells">
            <span>Клетки</span>
            <strong>{cellsOwned}</strong>
          </div>
          <div className="map-stat-card stat-influence">
            <span>Влияние</span>
            <strong>{totalInfluence}</strong>
          </div>
          <div className="map-stat-card stat-runs">
            <span>Пробежки</span>
            <strong>{totalRuns}</strong>
          </div>
        </div>
      </section>

      <div className="map-frame game-map-frame">
        <MapContainer
          key={`${defaultCenter[0]}-${defaultCenter[1]}`}
          center={defaultCenter}
          zoom={13}
          className="leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <MapEvents onMove={loadNearbyCells} />
          <FlyToCells targets={flyTargets} trigger={flyTrigger} />
          <MapOverlayControls
            canFocusMine={myCells.length > 0}
            onFocusMine={() => setFlyTrigger((value) => value + 1)}
          />

          {user?.homeLat != null && user.homeLng != null && (
            <>
              <Circle
                center={[user.homeLat, user.homeLng]}
                radius={500}
                pathOptions={{ color: '#f3a3d8', fillColor: '#b36bff', fillOpacity: 0.12, weight: 2 }}
              />
              <CircleMarker
                center={[user.homeLat, user.homeLng]}
                radius={9}
                pathOptions={{ color: '#ffffff', fillColor: '#1486ff', fillOpacity: 1, weight: 3 }}
              />
            </>
          )}

          {displayCells.map((cell) => {
            try {
              const boundary = organicBoundary(cell);
              const color = cellColor(cell, user?.id);
              return (
                <Polygon
                  key={cell.h3Index}
                  positions={boundary}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: cell.ownerId === user?.id ? 0.58 : 0.36,
                    opacity: 0.86,
                    weight: cell.ownerId === user?.id ? 1.6 : 1.1,
                    className: cell.ownerId === user?.id ? 'owned-cell' : 'rival-cell',
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
        <div className="map-vignette" aria-hidden="true" />

        <section className="map-hud map-capture-card">
          <div className="capture-icon" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>Твоя территория растёт!</strong>
            <span>Сейчас под контролем {cellsOwned} клеток.</span>
          </div>
          <b aria-hidden="true">›</b>
          {cellsFarFromHome && (
            <p>Клетки далеко от базы. Нажмите «Мои зоны», чтобы перейти к ним.</p>
          )}
          {error && <p className="map-inline-error">{error}</p>}
        </section>

        {loading && <div className="map-overlay">Обновление карты...</div>}
      </div>
    </div>
  );
}
