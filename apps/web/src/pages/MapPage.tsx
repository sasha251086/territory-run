import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { cellToBoundary, cellToLatLng } from 'h3-js';
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
import CellBottomSheet from '../components/CellBottomSheet';
import DistrictMapPopup from '../components/DistrictMapPopup';
import { useAuth } from '../context/AuthContext';
import { districtPolygonsForMap } from '../utils/district-geo';

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

function expandBounds(bounds: LatLngBounds, paddingRatio = 0.4): LatLngBounds {
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();
  const latPad = (north - south) * paddingRatio;
  const lngPad = (east - west) * paddingRatio;
  return L.latLngBounds([south - latPad, west - lngPad], [north + latPad, east + lngPad]);
}

function pruneCellsAwayFromBounds(
  cells: MapCell[],
  bounds: LatLngBounds,
  paddingRatio = 0.65,
): MapCell[] {
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();
  const latPad = (north - south) * paddingRatio;
  const lngPad = (east - west) * paddingRatio;
  const minLat = south - latPad;
  const maxLat = north + latPad;
  const minLng = west - lngPad;
  const maxLng = east + lngPad;

  return cells.filter((cell) => {
    const [lat, lng] = cellCenter(cell);
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });
}

function MapEvents({ onMove }: { onMove: (bounds: LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => onMove(map.getBounds()),
    zoomend: () => onMove(map.getBounds()),
  });
  return null;
}

type FlyMode = 'home' | 'territory' | 'targets';

type FlyRequest = {
  mode: FlyMode;
  trigger: number;
  points?: LatLngExpression[];
};

function cellCenter(cell: MapCell): [number, number] {
  if (cell.lat != null && cell.lng != null) {
    return [cell.lat, cell.lng];
  }
  const [lat, lng] = cellToLatLng(cell.h3Index);
  return [lat, lng];
}

function MapFlyController({
  request,
  homeCenter,
  territoryPoints,
}: {
  request: FlyRequest | null;
  homeCenter: [number, number] | null;
  territoryPoints: LatLngExpression[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!request) {
      return;
    }

    if (request.mode === 'home' && homeCenter) {
      map.setView(homeCenter, 13, { animate: true });
      return;
    }

    if (request.mode === 'territory' && territoryPoints.length > 0) {
      map.fitBounds(L.latLngBounds(territoryPoints), {
        padding: [56, 56],
        maxZoom: 14,
        animate: true,
      });
      return;
    }

    if (request.mode === 'targets' && request.points && request.points.length > 0) {
      map.fitBounds(L.latLngBounds(request.points), {
        padding: [32, 32],
        maxZoom: 15,
        animate: true,
      });
    }
    // Only fly when the user triggers navigation, not when cell lists refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, request?.trigger, request?.mode]);

  return null;
}

function HighlightPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('highlightPane')) {
      map.createPane('highlightPane');
      const pane = map.getPane('highlightPane');
      if (pane) {
        pane.style.zIndex = '380';
      }
    }
  }, [map]);
  return null;
}

const TARGET_FILL = '#F0E090';
const TARGET_STROKE = '#C9A030';
const CONTESTED_FILL = '#F0D890';
const CONTESTED_STROKE = '#C9A844';

function MapSheetDismiss({
  active,
  onDismiss,
}: {
  active: boolean;
  onDismiss: () => void;
}) {
  useMapEvents({
    click: () => {
      if (active) {
        onDismiss();
      }
    },
  });
  return null;
}

function MapControlBridge({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    const syncSize = () => map.invalidateSize();
    const attach = () => {
      syncSize();
      onMap(map);
    };
    map.whenReady(() => {
      attach();
      window.setTimeout(attach, 0);
      window.setTimeout(syncSize, 150);
    });
    window.addEventListener('resize', syncSize);
    return () => window.removeEventListener('resize', syncSize);
  }, [map, onMap]);
  return null;
}

function DistrictPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('districtPane')) {
      map.createPane('districtPane');
      const pane = map.getPane('districtPane');
      if (pane) {
        pane.style.zIndex = '350';
      }
    }
  }, [map]);
  return null;
}

function cellBoundary(h3Index: string): [number, number][] {
  return cellToBoundary(h3Index).map(([lat, lng]) => [lat, lng] as [number, number]);
}

type CellPaint = { fill: string; stroke: string; fillOpacity: number };

const MAX_CELL_INFLUENCE = 100;
/** Full saturation around this influence — matches typical per-cell values in play. */
const VISUAL_INFLUENCE_CAP = 12;
const MIN_INFLUENCE_FILL_OPACITY = 0.08;
const MAX_INFLUENCE_FILL_OPACITY = 0.98;

function influenceVisualStrength(influence: number): number {
  const clamped = Math.max(0, Math.min(MAX_CELL_INFLUENCE, influence));
  if (clamped <= 0) {
    return 0;
  }
  const normalized = Math.min(1, clamped / VISUAL_INFLUENCE_CAP);
  return Math.pow(normalized, 0.5);
}

function fillOpacityForInfluence(influence: number, min = MIN_INFLUENCE_FILL_OPACITY, max = MAX_INFLUENCE_FILL_OPACITY) {
  const strength = influenceVisualStrength(influence);
  return min + (max - min) * strength;
}

function cellPaint(
  cell: MapCell,
  currentUserId: string | undefined,
  rivalH3: Set<string>,
  targetH3: Set<string>,
  previewFlash: boolean,
): CellPaint {
  const influence = cell.influence ?? 0;
  const influenceOpacity = fillOpacityForInfluence(influence);

  if (targetH3.has(cell.h3Index)) {
    return { fill: TARGET_FILL, stroke: TARGET_STROKE, fillOpacity: influenceOpacity };
  }
  if (cell.contested) {
    return { fill: CONTESTED_FILL, stroke: CONTESTED_STROKE, fillOpacity: influenceOpacity };
  }
  if (rivalH3.has(cell.h3Index) && cell.ownerId !== currentUserId) {
    return { fill: '#A8B8CC', stroke: '#7A8FA8', fillOpacity: influenceOpacity };
  }
  if (cell.ownerId === currentUserId) {
    if (previewFlash) {
      return { fill: '#9BC49B', stroke: '#6B9A6B', fillOpacity: Math.min(0.96, influenceOpacity + 0.04) };
    }
    if (cell.decayRisk === 'critical') {
      return { fill: '#C99090', stroke: '#A86B6B', fillOpacity: influenceOpacity };
    }
    if (cell.decayRisk === 'warning') {
      return { fill: '#D4B896', stroke: '#B8956A', fillOpacity: influenceOpacity };
    }
    return { fill: '#9BC49B', stroke: '#6B9A6B', fillOpacity: influenceOpacity };
  }
  if (!cell.ownerId) {
    return { fill: '#F2F2F2', stroke: '#D8D8D8', fillOpacity: 0.22 };
  }
  return { fill: '#B8A8CC', stroke: '#8A7AA8', fillOpacity: influenceOpacity };
}

function resolveCellFillOpacity(
  paint: CellPaint,
  options: {
    isSelected: boolean;
    emphasizeMine: boolean;
    emphasizeTarget: boolean;
  },
) {
  if (options.isSelected) {
    return Math.min(0.98, paint.fillOpacity + 0.06);
  }
  if (options.emphasizeTarget) {
    return Math.min(0.96, paint.fillOpacity + 0.05);
  }
  if (options.emphasizeMine) {
    return Math.min(0.96, paint.fillOpacity + 0.04);
  }
  return paint.fillOpacity;
}

function cellClassName(
  cell: MapCell,
  currentUserId: string | undefined,
  rivalH3: Set<string>,
  targetH3: Set<string>,
  previewFlash: boolean,
) {
  const classes = ['map-cell-polygon'];
  if (cell.contested) {
    classes.push('contested-cell');
  } else if (cell.ownerId === currentUserId) {
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

function mergeCells(base: MapCell[], overlay: MapCell[]) {
  const byId = new Map<string, MapCell>();
  for (const cell of base) {
    byId.set(cell.h3Index, cell);
  }
  for (const cell of overlay) {
    const existing = byId.get(cell.h3Index);
    if (!existing) {
      byId.set(cell.h3Index, cell);
      continue;
    }
    byId.set(cell.h3Index, {
      ...existing,
      ...cell,
      contested: Boolean(existing.contested || cell.contested),
      contestGap: cell.contestGap ?? existing.contestGap,
      challengerNickname: cell.challengerNickname ?? existing.challengerNickname,
    });
  }
  return Array.from(byId.values());
}

export default function MapPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [nearbyCells, setNearbyCells] = useState<MapCell[]>([]);
  const [myCells, setMyCells] = useState<MapCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<MapCell | null>(null);
  const [flyRequest, setFlyRequest] = useState<FlyRequest | null>(null);
  const [territoryHighlight, setTerritoryHighlight] = useState(false);
  const [summary, setSummary] = useState<MapSummary | null>(null);
  const [targets, setTargets] = useState<CaptureTarget[]>([]);
  const [targetsHighlight, setTargetsHighlight] = useState(false);
  const [targetsMessage, setTargetsMessage] = useState<string | null>(null);
  const [findingTargets, setFindingTargets] = useState(false);
  const [rivalCells, setRivalCells] = useState<RivalCell[]>([]);
  const [previewFlash, setPreviewFlash] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const initialCellsLoadRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const fetchFrameRef = useRef<number | null>(null);
  const [districts, setDistricts] = useState<DistrictListItem[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictProgress | null>(null);
  const flyTriggerRef = useRef(0);

  const queueFly = useCallback((mode: FlyMode, points?: LatLngExpression[]) => {
    flyTriggerRef.current += 1;
    setFlyRequest({ mode, trigger: flyTriggerRef.current, points });
  }, []);

  const closeCellSheet = useCallback(() => setSelectedCell(null), []);

  const flyHome = useCallback(() => {
    setSelectedCell(null);
    setTerritoryHighlight(false);
    setTargets([]);
    setTargetsHighlight(false);
    setTargetsMessage(null);
    queueFly('home');
  }, [queueFly]);

  const flyTerritory = useCallback(() => {
    setSelectedCell(null);
    setTargets([]);
    setTargetsHighlight(false);
    setTargetsMessage(null);
    setTerritoryHighlight(true);
    queueFly('territory');
  }, [queueFly]);

  const dismissTargets = useCallback(() => {
    setTargets([]);
    setTargetsHighlight(false);
    setTargetsMessage(null);
  }, []);

  const dismissPreview = useCallback(() => {
    setPreviewMessage(null);
    setPreviewFlash(false);
  }, []);

  const dismissMapOverlay = useCallback(() => {
    if (previewMessage) {
      dismissPreview();
    }
    if (targetsHighlight) {
      dismissTargets();
    }
    if (selectedCell) {
      closeCellSheet();
    }
  }, [previewMessage, targetsHighlight, selectedCell, dismissPreview, dismissTargets, closeCellSheet]);

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

  const loadDistricts = useCallback(async () => {
    try {
      const allDistricts = await apiRequest<DistrictListItem[]>('/districts');
      setDistricts(allDistricts);
    } catch {
      setDistricts([]);
    }
  }, []);

  useEffect(() => {
    void loadDistricts();
  }, [loadDistricts, user?.stats?.cellsOwned]);

  const loadNearbyCells = useCallback(async (bounds: LatLngBounds) => {
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    const isFirstLoad = !initialLoadDoneRef.current;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const query = boundsToQuery(expandBounds(bounds));
      const data = await apiRequest<{ cells: MapCell[] }>(`/map/cells?${query.toString()}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }

      setNearbyCells((prev) => {
        const merged = mergeCells(prev, data.cells);
        return pruneCellsAwayFromBounds(merged, bounds);
      });
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Не удалось загрузить карту');
    } finally {
      if (controller.signal.aborted) {
        return;
      }
      initialLoadDoneRef.current = true;
      setInitialLoadDone(true);
      setLoading(false);
      setRefreshing(false);
      if (fetchControllerRef.current === controller) {
        fetchControllerRef.current = null;
      }
    }
  }, []);

  const queueNearbyCellsLoad = useCallback(
    (bounds: LatLngBounds) => {
      if (fetchFrameRef.current != null) {
        cancelAnimationFrame(fetchFrameRef.current);
      }
      fetchFrameRef.current = requestAnimationFrame(() => {
        fetchFrameRef.current = null;
        void loadNearbyCells(bounds);
      });
    },
    [loadNearbyCells],
  );

  const handleMapInstance = useCallback(
    (map: L.Map) => {
      if (!initialCellsLoadRef.current) {
        initialCellsLoadRef.current = true;
        void loadNearbyCells(map.getBounds());
      }
    },
    [loadNearbyCells],
  );

  useEffect(() => {
    return () => {
      fetchControllerRef.current?.abort();
      if (fetchFrameRef.current != null) {
        cancelAnimationFrame(fetchFrameRef.current);
      }
    };
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
    setTerritoryHighlight(true);
    queueFly('territory');

    const timer = window.setTimeout(() => setPreviewFlash(false), 4000);
    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams, queueFly]);

  useEffect(() => {
    if (!previewMessage) {
      return;
    }
    const timer = window.setTimeout(() => dismissPreview(), 8000);
    return () => window.clearTimeout(timer);
  }, [previewMessage, dismissPreview]);

  const displayCells = useMemo(
    () => mergeCells(nearbyCells, myCells),
    [myCells, nearbyCells],
  );

  const rivalH3 = useMemo(() => new Set(rivalCells.map((c) => c.h3Index)), [rivalCells]);
  const targetH3 = useMemo(() => new Set(targets.map((t) => t.h3Index)), [targets]);

  const territoryPoints = useMemo(
    () => myCells.map((cell) => cellCenter(cell) as LatLngExpression),
    [myCells],
  );

  const homeCenter = useMemo<[number, number] | null>(() => {
    if (user?.homeLat != null && user.homeLng != null) {
      return [user.homeLat, user.homeLng];
    }
    return null;
  }, [user?.homeLat, user?.homeLng]);

  async function handleFindTargets() {
    setFindingTargets(true);
    setError(null);
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
      setTerritoryHighlight(false);
      if (data.targets.length > 0) {
        setTargetsHighlight(true);
        queueFly(
          'targets',
          data.targets.map((t) => [t.lat, t.lng] as LatLngExpression),
        );
      } else {
        setTargetsHighlight(false);
        setTargetsMessage(null);
        setError('Рядом нет клеток для захвата — пробегитесь по новому маршруту.');
      }
    } catch (err) {
      setTargetsHighlight(false);
      setTargets([]);
      setTargetsMessage(null);
      setError(
        err instanceof Error ? err.message : 'Не удалось найти цели. Укажите домашнюю базу на карте.',
      );
    } finally {
      setFindingTargets(false);
    }
  }

  async function openDistrictProgress(districtId: string) {
    try {
      const progress = await apiRequest<DistrictProgress>(`/districts/${districtId}/progress`);
      setSelectedDistrict(progress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить район');
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

  const cellsOwned = user?.stats?.cellsOwned ?? 0;
  const currentStreak = user?.stats?.currentStreak ?? 0;
  const level = Math.max(1, Math.floor(cellsOwned / 12) + 1);
  const atRisk = summary?.cellsAtRisk ?? 0;

  const legendItems = [
    { fill: '#9BC49B', stroke: '#6B9A6B', label: 'Своя' },
    { fill: '#A8B8CC', stroke: '#7A8FA8', label: 'Соперник' },
    { fill: '#F2F2F2', stroke: '#D8D8D8', label: 'Нейтральная' },
    { fill: '#D4B896', stroke: '#B8956A', label: 'Риск' },
    { fill: '#C99090', stroke: '#A86B6B', label: 'Критично' },
    { fill: CONTESTED_FILL, stroke: CONTESTED_STROKE, label: 'Спор' },
    ...(targetsHighlight
      ? [{ fill: TARGET_FILL, stroke: TARGET_STROKE, label: 'Цель' }]
      : []),
  ];

  return (
    <div className="map-page">
      <header className="wire-map-header">
        <div className="wire-avatar" aria-hidden="true" />
        <div>
          <strong>{user?.nickname || 'runner'}</strong>
          <p>
            Ур. {level} · {cellsOwned} клеток
            {currentStreak > 0 ? ` · стрик ${currentStreak} дн` : ''}
          </p>
        </div>
      </header>

      <div className="map-frame">
        <MapContainer
          key={`${defaultCenter[0]}-${defaultCenter[1]}`}
          center={defaultCenter}
          zoom={13}
          zoomControl={false}
          attributionControl={false}
          className="leaflet-map"
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <MapControlBridge onMap={handleMapInstance} />
          <DistrictPane />
          <HighlightPane />
          <MapEvents onMove={queueNearbyCellsLoad} />
          <MapSheetDismiss
            active={targetsHighlight || selectedCell != null || previewMessage != null}
            onDismiss={dismissMapOverlay}
          />
          <MapFlyController
            request={flyRequest}
            homeCenter={homeCenter}
            territoryPoints={territoryPoints}
          />

          {targetsHighlight &&
            targets.map((target) => {
              try {
                const boundary = cellBoundary(target.h3Index);
                return (
                  <Polygon
                    key={`target-${target.h3Index}`}
                    positions={boundary}
                    pane="highlightPane"
                    pathOptions={{
                      color: TARGET_STROKE,
                      fillColor: TARGET_FILL,
                      fillOpacity: 0.92,
                      opacity: 1,
                      weight: 3.5,
                      lineJoin: 'round',
                      className: 'capture-target-cell capture-target-emphasis',
                    }}
                  />
                );
              } catch {
                return (
                  <Circle
                    key={`target-fallback-${target.h3Index}`}
                    center={[target.lat, target.lng]}
                    radius={95}
                    pane="highlightPane"
                    pathOptions={{
                      color: TARGET_STROKE,
                      fillColor: TARGET_FILL,
                      fillOpacity: 0.5,
                      weight: 3,
                      className: 'capture-target-cell capture-target-emphasis',
                    }}
                  />
                );
              }
            })}

          {districts.flatMap((district) =>
            districtPolygonsForMap(district.polygon).map((rings, partIndex) => (
              <Polygon
                key={`${district.id}-${partIndex}`}
                positions={rings}
                pane="districtPane"
                pathOptions={{
                  color: '#8A7AA8',
                  weight: 1.5,
                  opacity: 0.55,
                  fillOpacity: 0,
                  className: 'map-district-polygon',
                }}
                eventHandlers={{
                  click: () => void openDistrictProgress(district.id),
                }}
              >
                <Popup minWidth={220}>
                  <div className="map-district-popup map-district-popup--inline">
                    <h3>Район: {district.name}</h3>
                    <p>Король: {district.king?.nickname ?? 'Нет короля'}</p>
                    <button
                      type="button"
                      className="ghost-btn small-btn"
                      onClick={() => void openDistrictProgress(district.id)}
                    >
                      Подробнее
                    </button>
                  </div>
                </Popup>
              </Polygon>
            )),
          )}

          {user?.homeLat != null && user.homeLng != null && (
            <>
              <Circle
                center={[user.homeLat, user.homeLng]}
                radius={500}
                pathOptions={{
                  color: '#8A8A8A',
                  fillColor: '#E5E5E5',
                  fillOpacity: 0.25,
                  weight: 1.5,
                  dashArray: '6 4',
                }}
              />
              <CircleMarker
                center={[user.homeLat, user.homeLng]}
                radius={8}
                pathOptions={{
                  color: '#1A1A1A',
                  fillColor: '#C8C8C8',
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
            </>
          )}

          {displayCells.map((cell) => {
            try {
              const boundary = cellBoundary(cell.h3Index);
              const paint = cellPaint(cell, user?.id, rivalH3, targetH3, previewFlash);
              const isMine = cell.ownerId === user?.id;
              const isTarget = targetH3.has(cell.h3Index);
              const isSelected = selectedCell?.h3Index === cell.h3Index;
              const emphasizeMine = isMine && territoryHighlight;
              const emphasizeTarget = isTarget && targetsHighlight;
              const fillOpacity = resolveCellFillOpacity(paint, {
                isSelected,
                emphasizeMine,
                emphasizeTarget,
              });
              const strokeOpacity = 0.35 + 0.65 * influenceVisualStrength(cell.influence ?? 0);
              return (
                <Polygon
                  key={cell.h3Index}
                  positions={boundary}
                  pathOptions={{
                    color: isSelected
                      ? '#1A1A1A'
                      : emphasizeMine
                        ? '#4A7A4A'
                        : emphasizeTarget
                          ? TARGET_STROKE
                          : paint.stroke,
                    fillColor: paint.fill,
                    fillOpacity,
                    opacity: strokeOpacity,
                    weight: isSelected ? 4.5 : emphasizeMine || emphasizeTarget ? 3.5 : 2,
                    lineJoin: 'round',
                    className: [
                      cellClassName(cell, user?.id, rivalH3, targetH3, previewFlash),
                      emphasizeMine ? 'territory-emphasis' : '',
                      isSelected ? 'map-cell-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' '),
                  }}
                  eventHandlers={{
                    click: (event) => {
                      L.DomEvent.stopPropagation(event.originalEvent);
                      setSelectedCell(cell);
                    },
                  }}
                />
              );
            } catch {
              return null;
            }
          })}

          {selectedCell &&
            (() => {
              try {
                const paint = cellPaint(
                  selectedCell,
                  user?.id,
                  rivalH3,
                  targetH3,
                  previewFlash,
                );
                return (
                  <Polygon
                    key={`selected-${selectedCell.h3Index}`}
                    positions={cellBoundary(selectedCell.h3Index)}
                    pane="highlightPane"
                    pathOptions={{
                      color: '#1A1A1A',
                      fillColor: paint.fill,
                      fillOpacity: 0,
                      weight: 5,
                      opacity: 1,
                      lineJoin: 'round',
                      interactive: false,
                      className: 'map-cell-selected-ring',
                    }}
                  />
                );
              } catch {
                return null;
              }
            })()}
        </MapContainer>

        <ul className="map-legend" aria-label="Легенда карты">
          {legendItems.map((item) => (
            <li key={item.label}>
              <span style={{ background: item.fill, borderColor: item.stroke }} />
              {item.label}
            </li>
          ))}
        </ul>

        {selectedDistrict && (
          <div className="map-district-popup-wrap">
            <DistrictMapPopup
              progress={selectedDistrict}
              onClose={() => setSelectedDistrict(null)}
            />
          </div>
        )}

        {loading && displayCells.length === 0 && (
          <div className="map-overlay map-overlay--full">
            Загружаем карту…
          </div>
        )}

        {refreshing && <div className="map-sync-indicator" aria-hidden="true" />}

        {initialLoadDone && myCells.length === 0 && displayCells.length === 0 && (
          <div className="map-empty-state">
            <p><strong>У тебя пока нет клеток</strong></p>
            <p>Загрузи первую пробежку на вкладке «Бег».</p>
          </div>
        )}
      </div>

      {previewMessage && (
        <p className="map-floating-toast" role="status">
          {previewMessage}
        </p>
      )}

      {targetsHighlight && targetsMessage && (
        <p className="map-floating-toast" role="status">
          {targetsMessage}
        </p>
      )}

      <div className="map-action-bar" aria-label="Быстрые действия карты">
        <button type="button" onClick={flyTerritory} disabled={myCells.length === 0}>
          Моя территория
        </button>
        {atRisk > 0 && (
          <button type="button" onClick={flyTerritory}>⚠ {atRisk} клетки</button>
        )}
        <button type="button" onClick={flyHome} disabled={homeCenter == null}>
          Дом
        </button>
        <button
          type="button"
          onClick={() => void handleFindTargets()}
          disabled={findingTargets}
        >
          {findingTargets ? 'Поиск…' : 'Цели'}
        </button>
      </div>

      {error && (
        <p
          className="error-banner map-page-footnote"
          onClick={(event) => event.stopPropagation()}
        >
          {error}
        </p>
      )}
      {cellsFarFromHome && (
        <p className="muted small map-page-footnote">
          Клетки далеко от базы — нажмите «Моя территория».
        </p>
      )}

      <CellBottomSheet cell={selectedCell} onClose={closeCellSheet} />
    </div>
  );
}
