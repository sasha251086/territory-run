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
import type { LeaderboardEntry, MapCell } from '../api/types';
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
  if (!cell.ownerId) return '#64748b';
  if (cell.ownerId === currentUserId) return '#8dff42';
  return '#38bdf8';
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
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

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      try {
        const data = await apiRequest<LeaderboardEntry[]>('/leaderboard/cells?limit=4');
        if (!cancelled) {
          setLeaderboard(data);
        }
      } catch {
        if (!cancelled) {
          setLeaderboard([]);
        }
      }
    }

    void loadLeaderboard();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="map-page game-map-page">
      <div className="map-frame game-map-frame">
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
              const color = cellColor(cell, user?.id);
              return (
                <Polygon
                  key={cell.h3Index}
                  positions={boundary}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: cell.ownerId === user?.id ? 0.56 : 0.42,
                    opacity: 0.95,
                    weight: cell.ownerId === user?.id ? 2 : 1.4,
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

        <section className="map-hud map-hud-top">
          <div>
            <p className="eyebrow">Run the City</p>
            <h2>{user?.nickname || 'Runner'}</h2>
          </div>
          <div className="map-score-row">
            <span className="game-chip"><strong>{cellsOwned}</strong> зон</span>
            <span className="game-chip"><strong>{totalInfluence}</strong> влияния</span>
            <span className="game-chip"><strong>{totalRuns}</strong> бег</span>
          </div>
        </section>

        {leaderboard.length > 0 && (
          <section className="map-hud map-leaderboard-panel" aria-label="Лидеры по зонам">
            <p className="eyebrow">Urban Conquest</p>
            <ol>
              {leaderboard.map((item, index) => (
                <li key={item.userId} className={item.userId === user?.id ? 'is-you' : undefined}>
                  <span>{index + 1}</span>
                  <strong>{item.userId === user?.id ? 'Вы' : item.nickname}</strong>
                  <em>{Math.round(item.value)}</em>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="map-tools" aria-label="Инструменты карты">
          <button
            type="button"
            className="map-tool-btn"
            onClick={() => setFlyTrigger((value) => value + 1)}
            disabled={myCells.length === 0}
          >
            Мои зоны
          </button>
        </div>

        <section className="map-hud map-capture-card">
          <p className="eyebrow">Ваша территория</p>
          <strong>{cellsOwned} зон</strong>
          <span>Влияние: {totalInfluence}</span>
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
