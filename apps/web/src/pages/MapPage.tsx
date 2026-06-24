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
import { CellPreviewCard } from '../components/CellPopup';
import CellBottomSheet from '../components/CellBottomSheet';
import RunCelebrationOverlay from '../components/RunCelebrationOverlay';
import { cellColor as designCellColors } from '../design/Header';
import { MAP_TILE, computeInfluenceRange, ownedCellAppearance } from '../utils/map-tiles';
import {
  countDecayCells,
  findNearestDecayCell,
  shouldShowDecayToast,
} from '../utils/decay';
import { useAuth } from '../context/AuthContext';

const DECAY_WARNING_COLOR = '#f59e0b';
const DECAY_CRITICAL_COLOR = '#ef4444';
const HIGHLIGHT_DURATION_MS = 5000;

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

function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const refresh = () => map.invalidateSize();
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener('resize', refresh);

    const frame = map.getContainer().closest('.game-map-frame');
    const observer =
      frame && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(refresh)
        : null;
    if (frame && observer) {
      observer.observe(frame);
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', refresh);
      observer?.disconnect();
    };
  }, [map]);

  return null;
}

function cellBoundary(h3Index: string): [number, number][] {
  return cellToBoundary(h3Index).map(([lat, lng]) => [lat, lng] as [number, number]);
}

function cellAppearance(
  cell: MapCell,
  currentUserId: string | undefined,
  rivalH3: Set<string>,
  targetH3: Set<string>,
  previewFlash: boolean,
  influenceRange: { min: number; max: number },
): { fillColor: string; strokeColor: string; fillOpacity: number } {
  const isMine = cell.ownerId === currentUserId;

  if (isMine && !previewFlash) {
    if (cell.decayRisk === 'critical') {
      return {
        fillColor: DECAY_CRITICAL_COLOR,
        strokeColor: DECAY_CRITICAL_COLOR,
        fillOpacity: 0.78,
      };
    }
    if (cell.decayRisk === 'warning') {
      return {
        fillColor: DECAY_WARNING_COLOR,
        strokeColor: DECAY_WARNING_COLOR,
        fillOpacity: 0.72,
      };
    }
    return ownedCellAppearance(cell, influenceRange);
  }

  let fillColor = cellColor(cell, currentUserId, rivalH3, targetH3, previewFlash);
  return {
    fillColor,
    strokeColor: fillColor,
    fillOpacity: isMine ? 0.78 : targetH3.has(cell.h3Index) ? 0.68 : 0.58,
  };
}

function cellColor(
  cell: MapCell,
  currentUserId: string | undefined,
  rivalH3: Set<string>,
  targetH3: Set<string>,
  previewFlash: boolean,
) {
  if (targetH3.has(cell.h3Index)) {
    return designCellColors.target;
  }
  if (rivalH3.has(cell.h3Index) && cell.ownerId !== currentUserId) {
    return designCellColors.rival;
  }
  if (cell.ownerId === currentUserId) {
    if (previewFlash) return designCellColors.capture;
    if (cell.decayRisk === 'critical') return designCellColors.crit;
    if (cell.decayRisk === 'warning') return designCellColors.decay;
    return designCellColors.own;
  }
  if (!cell.ownerId) return designCellColors.empty;
  return designCellColors.other;
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
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [selectedCell, setSelectedCell] = useState<MapCell | null>(null);
  const [sheetCell, setSheetCell] = useState<MapCell | null>(null);
  const [celebration, setCelebration] = useState<{
    distanceKm?: number;
    cellsGained?: number;
    influenceGained?: number;
    title?: string;
  } | null>(null);
  const [highlightH3, setHighlightH3] = useState<Set<string>>(new Set());
  const [decayToast, setDecayToast] = useState<string | null>(null);

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
    setFlyTrigger((value) => value + 1);

    try {
      const parsed = JSON.parse(raw) as {
        distanceKm?: number;
        cellsGained?: number;
        influenceGained?: number;
        firstCapture?: boolean;
      };
      setCelebration({
        distanceKm: parsed.distanceKm,
        cellsGained: parsed.cellsGained,
        influenceGained: parsed.influenceGained,
        title: parsed.firstCapture ? 'Первый захват!' : 'Территория расширена!',
      });
    } catch {
      setCelebration({ title: 'Пробежка обработана!' });
    }

    const timer = window.setTimeout(() => setPreviewFlash(false), 4000);
    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const raw = searchParams.get('highlight');
    if (!raw) return;

    const indices = raw.split(',').filter(Boolean);
    if (indices.length === 0) return;

    setHighlightH3(new Set(indices));
    setPreviewFlash(true);
    setFlyTrigger((v) => v + 1);
    setSearchParams({}, { replace: true });

    const timer = window.setTimeout(() => {
      setHighlightH3(new Set());
      setPreviewFlash(false);
    }, HIGHLIGHT_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (myCells.length === 0) return;
    const { danger } = countDecayCells(myCells);
    if (shouldShowDecayToast(danger)) {
      setDecayToast(
        `У вас ${danger} клеток исчезнут в ближайшие дни. Пробегитесь по старым маршрутам!`,
      );
    }
  }, [myCells]);

  const displayCells = useMemo(
    () => mergeCells(myCells, nearbyCells),
    [myCells, nearbyCells],
  );

  const myInfluenceRange = useMemo(() => computeInfluenceRange(myCells), [myCells]);
  const decayCounts = useMemo(() => countDecayCells(myCells), [myCells]);

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

  function handleFlyToDecayCell() {
    const target = findNearestDecayCell(myCells);
    if (!target?.lat || !target.lng) {
      setFlyTrigger((v) => v + 1);
      return;
    }
    setFlyTrigger((v) => v + 1);
    mapInstance?.flyTo([target.lat, target.lng], 15, { duration: 0.8 });
  }

  const cellsOwned = user?.stats?.cellsOwned ?? 0;
  const currentStreak = user?.stats?.currentStreak ?? 0;
  const level = Math.max(1, Math.floor(cellsOwned / 12) + 1);
  const streakBonus = streakLabel(currentStreak);
  const atRisk = summary?.cellsAtRisk ?? 0;

  return (
    <div className="map-page game-map-page">
      <div className="map-frame game-map-frame">
        <MapContainer
          key={`${defaultCenter[0]}-${defaultCenter[1]}`}
          center={defaultCenter}
          zoom={13}
          className="leaflet-map"
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer attribution={MAP_TILE.attribution} url={MAP_TILE.url} />
          <MapControlBridge onMap={setMapInstance} />
          <MapResizeHandler />
          <MapEvents onMove={loadNearbyCells} />
          <FlyToCells targets={flyTargets} trigger={flyTrigger} />

          {user?.homeLat != null && user.homeLng != null && (
            <>
              <Circle
                center={[user.homeLat, user.homeLng]}
                radius={500}
                pathOptions={{
                  color: designCellColors.capture,
                  fillColor: designCellColors.capture,
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '6 4',
                }}
              />
              <CircleMarker
                center={[user.homeLat, user.homeLng]}
                radius={9}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: designCellColors.own,
                  fillOpacity: 1,
                  weight: 3,
                }}
              />
            </>
          )}

          {displayCells.map((cell) => {
            try {
              const boundary = cellBoundary(cell.h3Index);
              const isSelected = selectedCell?.h3Index === cell.h3Index;
              const appearance = cellAppearance(
                cell,
                user?.id,
                rivalH3,
                targetH3,
                previewFlash,
                myInfluenceRange,
              );
              const isHighlighted = highlightH3.has(cell.h3Index);
              return (
                <Polygon
                  key={cell.h3Index}
                  positions={boundary}
                  pathOptions={{
                    color: isHighlighted || isSelected ? '#ffffff' : appearance.strokeColor,
                    fillColor: appearance.fillColor,
                    fillOpacity: appearance.fillOpacity,
                    opacity: 1,
                    weight: isHighlighted ? 3 : isSelected ? 2 : targetH3.has(cell.h3Index) ? 2 : 0,
                    lineJoin: 'round',
                    className: cellClassName(cell, user?.id, rivalH3, targetH3, previewFlash),
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedCell(cell);
                      setSheetCell(null);
                    },
                  }}
                />
              );
            } catch {
              return null;
            }
          })}
        </MapContainer>

        <div className="tr-map-overlay-hud">
          <section className="tr-map-profile tr-glass">
            <div className="tr-map-profile__avatar" aria-hidden="true" />
            <div>
              <h1 className="tr-map-profile__name">{user?.nickname || 'runner'}</h1>
              <p className="tr-map-profile__sub">
                Ур.{level}
                {currentStreak > 0 && (
                  <>
                    {' '}
                    · <span className="streak">▲ стрик {currentStreak} дн</span>
                    {streakBonus ? ` ${streakBonus}` : ''}
                  </>
                )}
              </p>
            </div>
          </section>
          <section className="tr-map-cells-badge tr-glass">
            <strong>{cellsOwned}</strong>
            <span>клетки</span>
          </section>
        </div>

        {(decayCounts.danger > 0 || decayCounts.warning > 0) && (
          <button
            type="button"
            className={`tr-badge tr-glass${decayCounts.danger > 0 ? ' tr-badge--red' : ' tr-badge--orange'}`}
            style={{
              position: 'absolute',
              top: 'calc(56px + env(safe-area-inset-top))',
              left: 12,
              zIndex: 650,
              cursor: 'pointer',
              border: 'none',
              padding: '8px 12px',
            }}
            onClick={handleFlyToDecayCell}
          >
            {decayCounts.danger > 0
              ? `⚠ ${decayCounts.danger} клеток исчезнут через ${decayCounts.minDaysToDelete ?? '?'} дн.`
              : `⚠ ${decayCounts.warning} клеток угасают`}
          </button>
        )}

        {decayToast && (
          <div
            className="tr-glass"
            style={{
              position: 'absolute',
              top: 'calc(96px + env(safe-area-inset-top))',
              left: 12,
              right: 12,
              zIndex: 650,
              padding: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 12 }}>{decayToast}</p>
            <button type="button" className="tr-btn tr-btn-ghost" onClick={() => setDecayToast(null)}>
              Закрыть
            </button>
          </div>
        )}

        <div className="tr-map-controls" aria-label="Масштаб карты">
          <button type="button" className="tr-btn" aria-label="Увеличить" onClick={() => mapInstance?.zoomIn()} disabled={!mapInstance}>+</button>
          <button type="button" className="tr-btn" aria-label="Уменьшить" onClick={() => mapInstance?.zoomOut()} disabled={!mapInstance}>−</button>
          <button type="button" className="tr-btn" aria-label="К моей территории" onClick={() => setFlyTrigger((v) => v + 1)} disabled={myCells.length === 0}>⌖</button>
        </div>

        {selectedCell && !sheetCell && (
          <CellPreviewCard cell={selectedCell} onDetails={() => setSheetCell(selectedCell)} />
        )}

        <div className="tr-map-quick-bar">
          <button type="button" className="tr-map-quick-btn tr-map-quick-btn--accent" onClick={() => setFlyTrigger((v) => v + 1)}>
            <strong>{cellsOwned}</strong>
            кл.
          </button>
          <button type="button" className="tr-map-quick-btn tr-map-quick-btn--warn" onClick={() => atRisk > 0 && setFlyTrigger((v) => v + 1)}>
            <strong>{atRisk || '—'}</strong>
            {atRisk > 0 ? 'decay' : 'decay'}
          </button>
          <button type="button" className="tr-map-quick-btn" onClick={() => setFlyTrigger((v) => v + 1)} disabled={myCells.length === 0}>
            Мои зоны
          </button>
          <button type="button" className="tr-map-quick-btn tr-map-quick-btn--primary" onClick={() => void handleFindTargets()} disabled={findingTargets}>
            {findingTargets ? '…' : 'Цели'}
          </button>
        </div>

        {targetsMessage && (
          <p className="map-targets-msg" style={{ position: 'absolute', bottom: 72, left: 12, right: 12, zIndex: 600 }}>
            {targetsMessage}
          </p>
        )}

        <div className="map-vignette" aria-hidden="true" />
        {loading && <div className="map-overlay">Обновление карты…</div>}
        {error && <p className="map-inline-error" style={{ position: 'absolute', top: 80, left: 12, zIndex: 600 }}>{error}</p>}
      </div>

      <CellBottomSheet cell={sheetCell} onClose={() => { setSheetCell(null); setSelectedCell(null); }} />

      {celebration && (
        <RunCelebrationOverlay
          title={celebration.title}
          distanceKm={celebration.distanceKm}
          cellsGained={celebration.cellsGained}
          influenceGained={celebration.influenceGained}
          onDismiss={() => setCelebration(null)}
          onShare={() => {
            const text = `Territory Run: +${celebration.cellsGained ?? 0} клеток!`;
            if (navigator.share) {
              void navigator.share({ text, title: 'Territory Run' });
            }
          }}
        />
      )}
    </div>
  );
}
