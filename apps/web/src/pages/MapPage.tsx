import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import type {
  CaptureTarget,
  MapCell,
  MapSummary,
  RivalCell,
} from '../api/types';
import CellPopupContent from '../components/CellPopup';
import { useAuth } from '../context/AuthContext';
import { formatAreaM2, formatCellsArea } from '../utils/territory';

const RUN_PREVIEW_KEY = 'territory-run-run-preview';

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

function MapControlBridge({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}

function cellBoundary(h3Index: string): [number, number][] {
  return cellToBoundary(h3Index).map(([lat, lng]) => [lat, lng] as [number, number]);
}

function cellColor(
  cell: MapCell,
  currentUserId: string | undefined,
  rivalH3: Set<string>,
  targetH3: Set<string>,
  previewFlash: boolean,
) {
  if (targetH3.has(cell.h3Index)) {
    return '#f5c842';
  }
  if (rivalH3.has(cell.h3Index) && cell.ownerId !== currentUserId) {
    return '#ff6b9d';
  }
  if (cell.ownerId === currentUserId) {
    if (previewFlash) return '#3dff8a';
    if (cell.decayRisk === 'critical') return '#ff5a4a';
    if (cell.decayRisk === 'warning') return '#ff9f43';
    return '#45c8e7';
  }
  if (!cell.ownerId) return '#c6d3df';
  return '#9b6dff';
}

function cellClassName(
  cell: MapCell,
  currentUserId: string | undefined,
  rivalH3: Set<string>,
  targetH3: Set<string>,
  previewFlash: boolean,
) {
  const classes = ['map-cell-polygon'];
  if (cell.ownerId === currentUserId) {
    classes.push('owned-cell');
    if (previewFlash) classes.push('cell-preview-flash');
    if (cell.decayRisk === 'warning') classes.push('decay-warning');
    if (cell.decayRisk === 'critical') classes.push('decay-critical');
  } else if (rivalH3.has(cell.h3Index)) {
    classes.push('rival-tracked-cell');
  } else {
    classes.push('rival-cell');
  }
  if (targetH3.has(cell.h3Index)) {
    classes.push('capture-target-cell');
  }
  return classes.join(' ');
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

function streakLabel(streak: number) {
  if (streak >= 14) return '×1.3';
  if (streak >= 7) return '×1.2';
  if (streak >= 4) return '×1.1';
  return '';
}

export default function MapPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [nearbyCells, setNearbyCells] = useState<MapCell[]>([]);
  const [myCells, setMyCells] = useState<MapCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const [summary, setSummary] = useState<MapSummary | null>(null);
  const [targets, setTargets] = useState<CaptureTarget[]>([]);
  const [targetsMessage, setTargetsMessage] = useState<string | null>(null);
  const [findingTargets, setFindingTargets] = useState(false);
  const [rivalCells, setRivalCells] = useState<RivalCell[]>([]);
  const [previewFlash, setPreviewFlash] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

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

  const loadSummary = useCallback(async () => {
    try {
      const data = await apiRequest<MapSummary>('/map/summary');
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, []);

  const loadRivalCells = useCallback(async () => {
    try {
      const data = await apiRequest<{ cells: RivalCell[] }>('/map/rivals/cells');
      setRivalCells(data.cells);
    } catch {
      setRivalCells([]);
    }
  }, []);

  useEffect(() => {
    void loadMyCells();
    void loadSummary();
    void loadRivalCells();
  }, [loadMyCells, loadSummary, loadRivalCells, user?.stats?.cellsOwned]);

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
    const isPreview = searchParams.get('preview') === '1';
    const raw = sessionStorage.getItem(RUN_PREVIEW_KEY);
    if (!isPreview || !raw) {
      return;
    }

    sessionStorage.removeItem(RUN_PREVIEW_KEY);
    setSearchParams({}, { replace: true });
    setPreviewFlash(true);
    setPreviewMessage('Пробежка обработана! Ваши клетки подсвечены на карте.');
    setFlyTrigger((value) => value + 1);

    const timer = window.setTimeout(() => setPreviewFlash(false), 4000);
    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams]);

  const displayCells = useMemo(
    () => mergeCells(myCells, nearbyCells),
    [myCells, nearbyCells],
  );

  const rivalH3 = useMemo(() => new Set(rivalCells.map((c) => c.h3Index)), [rivalCells]);
  const targetH3 = useMemo(() => new Set(targets.map((t) => t.h3Index)), [targets]);

  const flyTargets = useMemo(() => {
    if (targets.length > 0) {
      return targets.map((t) => [t.lat, t.lng] as LatLngExpression);
    }
    return myCells
      .filter((cell) => cell.lat != null && cell.lng != null)
      .map((cell) => [cell.lat as number, cell.lng as number] as LatLngExpression);
  }, [myCells, targets]);

  async function handleFindTargets() {
    setFindingTargets(true);
    setTargetsMessage(null);
    try {
      let lat = user?.homeLat;
      let lng = user?.homeLng;

      if (lat == null || lng == null) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      }

      const data = await apiRequest<{ targets: CaptureTarget[]; message: string }>(
        `/map/targets?lat=${lat}&lng=${lng}`,
      );
      setTargets(data.targets);
      setTargetsMessage(data.message);
      if (data.targets.length > 0) {
        setFlyTrigger((value) => value + 1);
      }
    } catch (err) {
      setTargetsMessage(
        err instanceof Error ? err.message : 'Не удалось найти цели. Укажите домашнюю базу на карте.',
      );
    } finally {
      setFindingTargets(false);
    }
  }

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
  const currentStreak = user?.stats?.currentStreak ?? 0;
  const level = Math.max(1, Math.floor(cellsOwned / 12) + 1);
  const streakBonus = streakLabel(currentStreak);
  const territoryArea =
    summary?.territoryAreaM2 != null
      ? formatAreaM2(summary.territoryAreaM2)
      : formatCellsArea(cellsOwned);
  const atRisk = summary?.cellsAtRisk ?? 0;

  return (
    <div className="map-page game-map-page">
      <section className="map-profile-card">
        <div className="map-brand-row">
          <p className="eyebrow">Territory Run</p>
          <div className="level-hex" aria-label={`Уровень ${level}`}>
            <span>{level}</span>
          </div>
        </div>

        <div className="map-user-row">
          <div className="runner-avatar" aria-hidden="true">●</div>
          <div className="map-user-copy">
            <h1>{user?.nickname || 'runner'}</h1>
            <p className="map-territory-area">{territoryArea}</p>
          </div>
          {currentStreak > 0 && (
            <span className="streak-badge" title="Стрик активности">
              🔥 {currentStreak}
              {streakBonus ? ` ${streakBonus}` : ''}
            </span>
          )}
        </div>

        <div className="map-stat-cards">
          <div className="map-stat-card stat-cells">
            <span className="stat-icon" aria-hidden="true">⬡</span>
            <span>Клетки</span>
            <strong>{cellsOwned}</strong>
          </div>
          <div className="map-stat-card stat-influence">
            <span className="stat-icon" aria-hidden="true">⚡</span>
            <span>Влияние</span>
            <strong>{totalInfluence}</strong>
          </div>
          <div className="map-stat-card stat-runs">
            <span className="stat-icon" aria-hidden="true">👟</span>
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
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapControlBridge onMap={setMapInstance} />
          <MapEvents onMove={loadNearbyCells} />
          <FlyToCells targets={flyTargets} trigger={flyTrigger} />

          {user?.homeLat != null && user.homeLng != null && (
            <>
              <Circle
                center={[user.homeLat, user.homeLng]}
                radius={500}
                pathOptions={{ color: '#3dff8a', fillColor: '#3dff8a', fillOpacity: 0.08, weight: 2 }}
              />
              <CircleMarker
                center={[user.homeLat, user.homeLng]}
                radius={9}
                pathOptions={{ color: '#ffffff', fillColor: '#45c8e7', fillOpacity: 1, weight: 3 }}
              />
            </>
          )}

          {displayCells.map((cell) => {
            try {
              const boundary = cellBoundary(cell.h3Index);
              const color = cellColor(cell, user?.id, rivalH3, targetH3, previewFlash);
              const isMine = cell.ownerId === user?.id;
              return (
                <Polygon
                  key={cell.h3Index}
                  positions={boundary}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: isMine ? 0.78 : targetH3.has(cell.h3Index) ? 0.68 : 0.58,
                    opacity: 1,
                    weight: targetH3.has(cell.h3Index) ? 2 : 0,
                    lineJoin: 'round',
                    className: cellClassName(cell, user?.id, rivalH3, targetH3, previewFlash),
                  }}
                >
                  <Popup minWidth={240}>
                    <CellPopupContent cell={cell} />
                  </Popup>
                </Polygon>
              );
            } catch {
              return null;
            }
          })}
        </MapContainer>

        <div className="map-zoom-controls" aria-label="Масштаб карты">
          <button
            type="button"
            aria-label="Увеличить"
            onClick={() => mapInstance?.zoomIn()}
            disabled={!mapInstance}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Уменьшить"
            onClick={() => mapInstance?.zoomOut()}
            disabled={!mapInstance}
          >
            −
          </button>
          <button
            type="button"
            aria-label="К моей территории"
            onClick={() => setFlyTrigger((value) => value + 1)}
            disabled={myCells.length === 0}
          >
            ⌖
          </button>
        </div>

        <button
          type="button"
          className="map-tool-btn map-tool-left"
          onClick={() => setFlyTrigger((value) => value + 1)}
          disabled={myCells.length === 0}
        >
          Мои зоны
        </button>

        <div className="map-vignette" aria-hidden="true" />

        <section className="map-hud map-capture-card">
          {atRisk > 0 ? (
            <>
              <strong>⚠ {atRisk} под угрозой</strong>
              <span>Забегите снова, чтобы удержать территорию</span>
            </>
          ) : previewMessage ? (
            <>
              <strong>Готово!</strong>
              <span>{previewMessage}</span>
            </>
          ) : (
            <>
              <strong>{cellsOwned}</strong>
              <span>
                {territoryArea} · {totalInfluence} влияния
              </span>
            </>
          )}

          {targetsMessage && <p className="map-targets-msg">{targetsMessage}</p>}
          {!targetsMessage && atRisk === 0 && (
            <button
              type="button"
              className="map-find-targets-btn"
              onClick={() => void handleFindTargets()}
              disabled={findingTargets}
            >
              {findingTargets ? 'Поиск целей…' : 'Найти цели'}
            </button>
          )}

          {cellsFarFromHome && (
            <p className="map-capture-footnote">Клетки далеко от базы. Нажмите «Мои зоны».</p>
          )}
          {error && <p className="map-inline-error">{error}</p>}
        </section>

        {loading && <div className="map-overlay">Обновление карты...</div>}
      </div>
    </div>
  );
}
