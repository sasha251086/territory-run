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
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [showDistricts, setShowDistricts] = useState(true);

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
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <MapControlBridge onMap={setMapInstance} />
          <MapEvents onMove={loadNearbyCells} />
          <FlyToCells targets={flyTargets} trigger={flyTrigger} />

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

          {showDistricts &&
            districts.flatMap((district) =>
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
                    fillOpacity: isMine ? 0.62 : targetH3.has(cell.h3Index) ? 0.52 : 0.42,
                    opacity: 1,
                    weight: 0.8,
                    lineJoin: 'round',
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
            <svg viewBox="0 0 24 24" aria-hidden="true" className="map-btn-icon">
              <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="11" r="2.2" fill="currentColor" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="map-tool-btn map-tool-left"
          onClick={() => setFlyTrigger((value) => value + 1)}
          disabled={myCells.length === 0}
          aria-label="Показать мои клетки"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="map-btn-icon">
            <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          className="map-tool-btn map-tool-right"
          onClick={() => setShowDistricts((value) => !value)}
          aria-label={showDistricts ? 'Скрыть районы' : 'Показать районы'}
          title={showDistricts ? 'Скрыть районы' : 'Показать районы'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="map-btn-icon">
            <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 12 3 7M12 12l9-5M12 12v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>

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
            {!targetsMessage && (
              <button
                type="button"
                className="map-find-targets-btn"
                onClick={() => void handleFindTargets()}
                disabled={findingTargets}
              >
                {findingTargets ? 'Поиск целей…' : 'Найти цели'}
              </button>
            )}
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
