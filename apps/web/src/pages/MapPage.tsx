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
  DistrictListItem,
  DistrictProgress,
  MapCell,
  MapSummary,
  RivalCell,
} from '../api/types';
import CellPopupContent from '../components/CellPopup';
import { useAuth } from '../context/AuthContext';

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

function MapOverlayControls({
  canFocusMine,
  onFocusMine,
  onFindTargets,
  findingTargets,
}: {
  canFocusMine: boolean;
  onFocusMine: () => void;
  onFindTargets: () => void;
  findingTargets: boolean;
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
          className="map-tool-btn map-target-btn"
          onClick={onFindTargets}
          disabled={findingTargets}
          aria-label="Найти цели захвата"
          title="Найти цели"
        >
          ★
        </button>
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

function polygonCoords(polygon: DistrictListItem['polygon']): [number, number][][] {
  const coords = polygon.coordinates;
  if (polygon.type === 'Polygon') {
    return (coords as number[][][]).map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as [number, number]),
    );
  }
  return (coords as number[][][][]).flatMap((poly) =>
    poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
  );
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
  const [districts, setDistricts] = useState<DistrictListItem[]>([]);
  const [districtProgress, setDistrictProgress] = useState<DistrictProgress | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [previewFlash, setPreviewFlash] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);

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

  const loadDistricts = useCallback(async () => {
    try {
      const data = await apiRequest<DistrictListItem[]>('/districts');
      setDistricts(data);
      if (data.length > 0 && !selectedDistrictId) {
        setSelectedDistrictId(data[0].id);
      }
    } catch {
      setDistricts([]);
    }
  }, [selectedDistrictId]);

  const loadDistrictProgress = useCallback(async (districtId: string) => {
    try {
      const data = await apiRequest<DistrictProgress>(`/districts/${districtId}/progress`);
      setDistrictProgress(data);
    } catch {
      setDistrictProgress(null);
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
    void loadSummary();
    void loadRivalCells();
    void loadDistricts();
  }, [loadMyCells, loadSummary, loadRivalCells, loadDistricts, user?.stats?.cellsOwned]);

  useEffect(() => {
    if (selectedDistrictId) {
      void loadDistrictProgress(selectedDistrictId);
    }
  }, [selectedDistrictId, loadDistrictProgress, user?.stats?.cellsOwned]);

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
          {currentStreak > 0 && (
            <span className="streak-badge" title="Стрик активности">
              🔥 {currentStreak}
              {streakBonus ? ` ${streakBonus}` : ''}
            </span>
          )}
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
            onFindTargets={() => void handleFindTargets()}
            findingTargets={findingTargets}
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

          {districts.map((district) =>
            polygonCoords(district.polygon).map((ring, ringIndex) => (
              <Polygon
                key={`${district.id}-${ringIndex}`}
                positions={ring}
                pathOptions={{
                  color: '#6b7cff',
                  fillColor: 'transparent',
                  fillOpacity: 0,
                  weight: 2,
                  dashArray: '6 4',
                  className: 'district-boundary',
                }}
                eventHandlers={{
                  click: () => setSelectedDistrictId(district.id),
                }}
              >
                <Popup>
                  <strong>{district.name}</strong>
                  <br />
                  {district.king
                    ? `Король: ${district.king.nickname}`
                    : 'Король не определён'}
                </Popup>
              </Polygon>
            )),
          )}

          {displayCells.map((cell) => {
            try {
              const boundary = organicBoundary(cell);
              const color = cellColor(cell, user?.id, rivalH3, targetH3, previewFlash);
              const isMine = cell.ownerId === user?.id;
              return (
                <Polygon
                  key={cell.h3Index}
                  positions={boundary}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: isMine ? 0.58 : targetH3.has(cell.h3Index) ? 0.5 : 0.36,
                    opacity: 0.86,
                    weight: isMine || targetH3.has(cell.h3Index) ? 1.8 : 1.1,
                    className: cellClassName(cell, user?.id, rivalH3, targetH3, previewFlash),
                  }}
                >
                  <Popup maxWidth={280}>
                    <CellPopupContent cell={cell} />
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
            {summary != null && summary.cellsAtRisk > 0 && (
              <span className="map-risk-count">
                {summary.cellsAtRisk} клеток под угрозой затухания
              </span>
            )}
            {districtProgress && districtProgress.myControlPercent > 0 && (
              <span className="map-district-hud">
                Район «{districtProgress.districtName}»: {districtProgress.myControlPercent}%
                {districtProgress.isKing ? ' · вы король!' : ` · до короны ${districtProgress.kingThresholdPercent}%`}
              </span>
            )}
            {targetsMessage && <span className="map-targets-msg">{targetsMessage}</span>}
            {previewMessage && (
              <span className="map-preview-msg">
                {previewMessage}
                {'share' in navigator && (
                  <button
                    type="button"
                    className="ghost-btn small-btn map-share-btn"
                    onClick={() =>
                      void navigator.share?.({
                        title: 'Territory Run',
                        text: previewMessage,
                      })
                    }
                  >
                    Поделиться
                  </button>
                )}
              </span>
            )}
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
