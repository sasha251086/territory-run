import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
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
import CellInfluenceLabels from '../components/CellInfluenceLabels';
import MapCellPolygons from '../components/MapCellPolygons';
import MapCellHatchOverlay from '../components/MapCellHatchOverlay';
import MapHatchPatternDefs from '../components/MapHatchPatternDefs';
import MapLegendHelpModal from '../components/MapLegendHelpModal';
import GameTutorialModal from '../components/GameTutorialModal';
import NewcomerGuideModal from '../components/NewcomerGuideModal';
import FirstCaptureModal from '../components/FirstCaptureModal';
import StreakBadge from '../components/StreakBadge';
import WeeklyReportCard from '../components/WeeklyReportCard';
import { useAuth } from '../context/AuthContext';
import { hasSeenHint } from '../utils/first-time-hint';
import { resolveWeeklyReport } from '../utils/weekly-report';
import { enrichMapSummary } from '../utils/map-summary-enrich';
import { streakDisplay } from '../utils/streak-display';
import { useActiveSiege } from '../hooks/useActiveSiege';
import { districtPolygonsForMap } from '../utils/district-geo';
import { HOME_ZONE_RADIUS_M, SOFT_CAP_CELLS, streakMultiplier } from '../constants/game';
import { cellsWord } from '../utils/cell-lifespan';
import { missionTargetCount, formatTodayMissions } from '../utils/mission-format';
import {
  clearPostRunQueue,
  hasPostRunQueue,
  readPostRunQueue,
  type PostRunQueue,
} from '../utils/post-run-queue';
import {
  isStaleCell,
  MAP_OWN_FILL,
  MAP_OWN_STROKE,
  MAP_RIVAL_FILL,
  MAP_RIVAL_STROKE,
  NEUTRAL_FILL,
  NEUTRAL_STROKE,
} from '../utils/map-cell-visual';
import { targetCategoryToHatch } from '../utils/map-hatch';
import { h3IndicesFromRoute } from '../utils/track-distance.util';
import { ACTIVITY_FOCUS_KEY } from '../utils/activity-map-focus';

const RUN_PREVIEW_KEY = 'territory-run-run-preview';
const MAP_GUIDE_KEY = 'territory-run-map-guide-seen';
const ACTIVITY_FOCUS_GRACE_MS = 700;

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

function ActivityFocusPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('activityFocusPane')) {
      map.createPane('activityFocusPane');
      const pane = map.getPane('activityFocusPane');
      if (pane) {
        pane.style.zIndex = '420';
        pane.style.pointerEvents = 'none';
      }
    }
  }, [map]);
  return null;
}

function LabelPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('labelPane')) {
      map.createPane('labelPane');
      const pane = map.getPane('labelPane');
      if (pane) {
        pane.style.zIndex = '450';
        pane.style.pointerEvents = 'none';
      }
    }
  }, [map]);
  return null;
}

function MapZoomTracker({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMap();
  useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
    load: () => onZoom(map.getZoom()),
  });
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  return null;
}

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
  const { user, refreshProfile } = useAuth();
  const location = useLocation();
  const {
    visible: siegeVisible,
    gapPercent,
    h3Index: siegeH3Index,
    chipLabel: siegeChipLabel,
    challengerNickname: siegeChallengerNickname,
  } = useActiveSiege(user?.id);
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
  const [mapZoom, setMapZoom] = useState(13);
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [showMapGuide, setShowMapGuide] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [showPostRunTutorial, setShowPostRunTutorial] = useState(false);
  const [showPostRunFirstCapture, setShowPostRunFirstCapture] = useState(false);
  const [postRunCaptureCells, setPostRunCaptureCells] = useState(0);
  const [showNewcomerGuide, setShowNewcomerGuide] = useState(false);
  const [siegeFocusActive, setSiegeFocusActive] = useState(false);
  const [activityFocusH3, setActivityFocusH3] = useState<Set<string>>(() => new Set());
  const [activityFocusActive, setActivityFocusActive] = useState(false);
  const postRunQueueRef = useRef<PostRunQueue | null>(null);
  const flyTriggerRef = useRef(0);
  const activityFocusGraceUntilRef = useRef(0);

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
    setShowStaleOnly(false);
    queueFly('territory');
  }, [queueFly]);

  const focusStaleCells = useCallback(() => {
    setSelectedCell(null);
    setTargets([]);
    setTargetsHighlight(false);
    setTargetsMessage(null);
    setShowStaleOnly(true);
    setTerritoryHighlight(true);
    const stalePoints = myCells
      .filter((cell) => isStaleCell(cell, user?.id))
      .map((cell) => cellCenter(cell) as LatLngExpression);
    if (stalePoints.length > 0) {
      queueFly('territory', stalePoints);
    }
  }, [myCells, queueFly, user?.id]);

  const dismissTargets = useCallback(() => {
    setTargets([]);
    setTargetsHighlight(false);
    setTargetsMessage(null);
  }, []);

  const dismissSiegeFocus = useCallback(() => {
    setSiegeFocusActive(false);
  }, []);

  const dismissActivityFocus = useCallback(() => {
    if (Date.now() < activityFocusGraceUntilRef.current) {
      return;
    }
    setActivityFocusActive(false);
    setActivityFocusH3(new Set());
  }, []);

  useEffect(() => {
    if (!siegeFocusActive) {
      return;
    }
    const dismiss = () => dismissSiegeFocus();
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', dismiss, { capture: true });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', dismiss, { capture: true });
    };
  }, [siegeFocusActive, dismissSiegeFocus]);

  useEffect(() => {
    if (!activityFocusActive) {
      return;
    }
    const dismiss = () => dismissActivityFocus();
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', dismiss, { capture: true });
    }, ACTIVITY_FOCUS_GRACE_MS);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', dismiss, { capture: true });
    };
  }, [activityFocusActive, dismissActivityFocus]);

  useEffect(() => {
    if (!targetsHighlight) {
      return;
    }
    const dismiss = () => dismissTargets();
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', dismiss, { capture: true });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', dismiss, { capture: true });
    };
  }, [targetsHighlight, dismissTargets]);

  const siegeThreatH3 = useMemo(() => {
    const set = new Set<string>();
    for (const cell of myCells) {
      if (cell.ownerId === user?.id && (cell.contested || cell.challengerNickname)) {
        set.add(cell.h3Index);
      }
    }
    if (siegeH3Index) {
      set.add(siegeH3Index);
    }
    return set;
  }, [myCells, siegeH3Index, user?.id]);

  const focusSiegeOnMap = useCallback(() => {
    dismissTargets();
    dismissActivityFocus();
    setTerritoryHighlight(false);
    setShowStaleOnly(false);
    setPreviewMessage(null);
    setPreviewFlash(false);
    setSelectedCell(null);
    setSiegeFocusActive(true);

    const points: LatLngExpression[] = [];
    for (const cell of myCells) {
      if (siegeThreatH3.has(cell.h3Index)) {
        points.push(cellCenter(cell) as LatLngExpression);
      }
    }
    if (points.length === 0) {
      for (const h3Index of siegeThreatH3) {
        try {
          const [lat, lng] = cellToLatLng(h3Index);
          points.push([lat, lng]);
        } catch {
          // skip invalid h3
        }
      }
    }
    if (points.length > 0) {
      queueFly('targets', points);
    }
  }, [dismissTargets, dismissActivityFocus, myCells, queueFly, siegeThreatH3]);

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
    if (siegeFocusActive) {
      dismissSiegeFocus();
    }
    if (activityFocusActive) {
      dismissActivityFocus();
    }
    if (selectedCell) {
      closeCellSheet();
    }
  }, [
    previewMessage,
    targetsHighlight,
    siegeFocusActive,
    activityFocusActive,
    selectedCell,
    dismissPreview,
    dismissTargets,
    dismissSiegeFocus,
    dismissActivityFocus,
    closeCellSheet,
  ]);

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

  useEffect(() => {
    if (localStorage.getItem(MAP_GUIDE_KEY) === '1') {
      return;
    }
    if (hasPostRunQueue() || hasSeenHint('newcomer-guide')) {
      return;
    }
    setShowMapGuide(true);
  }, []);

  useEffect(() => {
    if (hasSeenHint('newcomer-guide') || hasPostRunQueue()) {
      return;
    }
    const welcome = (location.state as { welcome?: boolean } | null)?.welcome === true;
    const isNewPlayer =
      (user?.stats?.totalRuns ?? 0) === 0 && (user?.stats?.cellsOwned ?? 0) === 0;
    if (welcome || isNewPlayer) {
      setShowNewcomerGuide(true);
      setShowMapGuide(false);
    }
  }, [location.state, user?.stats?.totalRuns, user?.stats?.cellsOwned]);

  const beginPostRunFirstCapture = useCallback((cells: number) => {
    setPostRunCaptureCells(cells);
    setShowPostRunFirstCapture(true);
  }, []);

  const processPostRunQueue = useCallback(() => {
    const queue = readPostRunQueue();
    if (!queue) {
      return;
    }
    postRunQueueRef.current = queue;

    if (queue.showTutorial) {
      setShowPostRunTutorial(true);
      return;
    }

    if (queue.showFirstCapture) {
      clearPostRunQueue();
      beginPostRunFirstCapture(queue.captureCells ?? 0);
    }
  }, [beginPostRunFirstCapture]);

  async function dismissPostRunTutorial() {
    setShowPostRunTutorial(false);
    try {
      await apiRequest('/users/me/game-tutorial-shown', { method: 'POST' });
      await refreshProfile();
    } catch {
      // non-blocking
    }

    const queue = postRunQueueRef.current ?? readPostRunQueue();
    postRunQueueRef.current = null;
    clearPostRunQueue();

    if (queue?.showFirstCapture) {
      beginPostRunFirstCapture(queue.captureCells ?? 0);
    }
  }

  function dismissPostRunFirstCapture() {
    setShowPostRunFirstCapture(false);
    postRunQueueRef.current = null;
    clearPostRunQueue();
  }

  const dismissMapGuide = useCallback(() => {
    localStorage.setItem(MAP_GUIDE_KEY, '1');
    setShowMapGuide(false);
  }, []);

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

    const flashTimer = window.setTimeout(() => setPreviewFlash(false), 4000);
    const queueTimer = window.setTimeout(() => processPostRunQueue(), 4200);
    return () => {
      window.clearTimeout(flashTimer);
      window.clearTimeout(queueTimer);
    };
  }, [searchParams, setSearchParams, queueFly, processPostRunQueue]);

  useEffect(() => {
    const h3Index = searchParams.get('highlight');
    if (!h3Index) {
      return;
    }

    setSearchParams({}, { replace: true });
    const fromMap =
      nearbyCells.find((cell) => cell.h3Index === h3Index) ??
      myCells.find((cell) => cell.h3Index === h3Index) ??
      null;

    try {
      const [lat, lng] = cellToLatLng(h3Index);
      const cell: MapCell =
        fromMap ??
        ({
          h3Index,
          lat,
          lng,
          ownerId: null,
          ownerNickname: null,
          influence: 0,
          lastActivityAt: null,
        } satisfies MapCell);
      setSelectedCell(cell);
      setSiegeFocusActive(false);
      setFlyRequest({
        mode: 'targets',
        trigger: ++flyTriggerRef.current,
        points: [[lat, lng]],
      });
    } catch {
      // invalid h3 index in URL
    }
  }, [searchParams, setSearchParams, nearbyCells, myCells]);

  useEffect(() => {
    if (searchParams.get('focus') !== 'siege') {
      return;
    }
    setSearchParams({}, { replace: true });
    focusSiegeOnMap();
  }, [searchParams, setSearchParams, focusSiegeOnMap]);

  useEffect(() => {
    const activityId =
      searchParams.get('activity') ?? sessionStorage.getItem(ACTIVITY_FOCUS_KEY);
    if (!activityId) {
      return;
    }

    sessionStorage.removeItem(ACTIVITY_FOCUS_KEY);

    let cancelled = false;
    void apiRequest<{
      bounds: { north: number; south: number; east: number; west: number } | null;
      h3Indices?: string[];
      route?: { lat: number; lng: number }[];
    }>(`/activities/${activityId}`)
      .then((activity) => {
        if (cancelled) {
          return;
        }

        dismissTargets();
        dismissSiegeFocus();
        setTerritoryHighlight(false);
        setPreviewMessage(null);
        setPreviewFlash(false);
        setSelectedCell(null);

        const h3List = h3IndicesFromRoute(activity.route, activity.h3Indices);
        const h3Set = new Set(h3List);
        setActivityFocusH3(h3Set);
        setActivityFocusActive(h3Set.size > 0);
        if (h3Set.size > 0) {
          activityFocusGraceUntilRef.current = Date.now() + ACTIVITY_FOCUS_GRACE_MS;
        }

        const points: LatLngExpression[] = [];
        for (const h3Index of h3Set) {
          try {
            const [lat, lng] = cellToLatLng(h3Index);
            points.push([lat, lng]);
          } catch {
            // skip invalid h3
          }
        }
        if (points.length === 0 && activity.bounds) {
          const { north, south, east, west } = activity.bounds;
          points.push(
            [north, west],
            [south, east],
          );
        }
        if (points.length > 0) {
          setFlyRequest({
            mode: 'targets',
            trigger: ++flyTriggerRef.current,
            points,
          });
        }
        setSearchParams({}, { replace: true });
      })
      .catch(() => {
        if (!cancelled) {
          setSearchParams({}, { replace: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, dismissTargets, dismissSiegeFocus]);

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

  const visibleCells = useMemo(() => {
    if (!showStaleOnly) {
      return displayCells;
    }
    return displayCells.filter((cell) => isStaleCell(cell, user?.id));
  }, [displayCells, showStaleOnly, user?.id]);

  const visibleH3 = useMemo(() => new Set(visibleCells.map((cell) => cell.h3Index)), [visibleCells]);

  const rivalH3 = useMemo(() => new Set(rivalCells.map((c) => c.h3Index)), [rivalCells]);
  const targetH3 = useMemo(() => new Set(targets.map((t) => t.h3Index)), [targets]);
  const targetCategoryByH3 = useMemo(() => {
    const map = new Map<string, CaptureTarget['category']>();
    for (const target of targets) {
      map.set(target.h3Index, target.category);
    }
    return map;
  }, [targets]);

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
      setSiegeFocusActive(false);
      dismissActivityFocus();
      if (data.targets.length > 0) {
        setTargetsHighlight(true);
        void loadSummary();
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
  const enrichedSummary = useMemo(
    () => (summary ? enrichMapSummary(summary, myCells, cellsOwned) : null),
    [summary, myCells, cellsOwned],
  );
  const cellsNeedingRun =
    (enrichedSummary?.cellsWarning ?? 0) + (enrichedSummary?.cellsCritical ?? 0);
  const atSoftCap = cellsOwned >= SOFT_CAP_CELLS;

  const legendItems: Array<
    | { fill: string; stroke: string; label: string; dash?: false; split?: false }
    | { dash: true; stroke: string; label: string; fill?: undefined; split?: false }
    | { split: true; label: string; fill?: undefined; dash?: false; stroke?: undefined }
  > = [
    { fill: MAP_OWN_FILL, stroke: MAP_OWN_STROKE, label: 'Своя' },
    { fill: MAP_RIVAL_FILL, stroke: MAP_RIVAL_STROKE, label: 'Соперник' },
    { fill: NEUTRAL_FILL, stroke: NEUTRAL_STROKE, label: 'Пустая' },
    { split: true, label: 'Спорная' },
    { dash: true, stroke: '#C4A35A', label: 'Давно не бегали' },
  ];

  const streakInfo = streakDisplay(currentStreak);
  const weeklyReport = resolveWeeklyReport(enrichedSummary);
  const missionCount = enrichedSummary?.missions ? missionTargetCount(enrichedSummary.missions) : 0;
  const todayMissionsLine =
    enrichedSummary?.missions && enrichedSummary.missions.length > 0
      ? formatTodayMissions(enrichedSummary.missions)
      : null;
  const targetsButtonLabel = findingTargets
    ? 'Поиск…'
    : missionCount > 0
      ? `Цели (${missionCount})`
      : 'Цели';

  return (
    <div className="map-page">
      <header className="wire-map-header wire-map-header--mobile">
        <div className="wire-avatar" aria-hidden="true" />
        <div className="wire-map-header-main">
          <strong>{user?.nickname || 'runner'}</strong>
          <div className="map-header-stats map-header-stats--mobile">
            <p>
              {cellsOwned} {cellsWord(cellsOwned)}
              {atSoftCap ? ' · лимит' : ''}
            </p>
            {currentStreak > 0 && (
              <div className="map-header-streak">
                <StreakBadge streak={currentStreak} compact />
                {streakInfo.nextMilestone != null && streakInfo.tier === 'none' && (
                  <span className="muted small map-header-streak__hint">
                    до ×{streakMultiplier(streakInfo.nextMilestone).toFixed(1)} —{' '}
                    {streakInfo.nextMilestone} дн
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="map-header-chips map-header-chips--mobile">
          {siegeVisible && siegeChipLabel && (
            <button
              type="button"
              className={`map-siege-chip${gapPercent != null && gapPercent >= 80 ? ' map-siege-chip--urgent' : ''}`}
              onClick={focusSiegeOnMap}
            >
              {gapPercent != null && gapPercent >= 80 ? '⚠ ' : ''}
              {siegeChipLabel}
              {siegeThreatH3.size > 1 && (
                <span className="chip-count">+{siegeThreatH3.size - 1}</span>
              )}
            </button>
          )}
          {cellsNeedingRun > 0 && (
            <button type="button" className="map-alert-chip" onClick={focusStaleCells}>
              ⚠ {cellsNeedingRun}
            </button>
          )}
        </div>
      </header>

      {todayMissionsLine && (
        <div className="map-today-bar map-today-bar--mobile">
          <span className="map-today-bar__label">Сегодня</span>
          <span className="map-today-bar__text">{todayMissionsLine}</span>
          <button
            type="button"
            className="ghost-btn small-btn map-today-bar__action"
            onClick={() => void handleFindTargets()}
            disabled={findingTargets}
          >
            {findingTargets ? 'Поиск…' : 'На карте'}
          </button>
        </div>
      )}

      {showStaleOnly && (
        <div className="map-filter-bar">
          <span>Только клетки без пробежки</span>
          <button type="button" className="ghost-btn small-btn" onClick={() => setShowStaleOnly(false)}>
            Показать все
          </button>
        </div>
      )}

      {showMapGuide && <MapLegendHelpModal onClose={dismissMapGuide} />}
      {showNewcomerGuide && (
        <NewcomerGuideModal onClose={() => setShowNewcomerGuide(false)} />
      )}
      {showPostRunTutorial && (
        <GameTutorialModal onClose={() => void dismissPostRunTutorial()} />
      )}
      {showPostRunFirstCapture && (
        <FirstCaptureModal
          cellsCaptured={postRunCaptureCells}
          onClose={dismissPostRunFirstCapture}
        />
      )}

      <div className="map-page-body">
        <div className="map-page-main">
      <div className="map-frame">
        {!initialLoadDone && (
          <div className="map-skeleton" aria-label="Загрузка карты" aria-live="polite">
            <div className="map-skeleton__pulse" />
            <p className="map-skeleton__text">Загружаем территорию…</p>
          </div>
        )}
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
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <MapControlBridge onMap={handleMapInstance} />
          <DistrictPane />
          <HighlightPane />
          <ActivityFocusPane />
          <LabelPane />
          <MapHatchPatternDefs />
          <MapZoomTracker onZoom={setMapZoom} />
          <MapEvents onMove={queueNearbyCellsLoad} />
          <MapSheetDismiss
            active={
              targetsHighlight ||
              selectedCell != null ||
              previewMessage != null ||
              siegeFocusActive ||
              activityFocusActive
            }
            onDismiss={dismissMapOverlay}
          />
          <MapFlyController
            request={flyRequest}
            homeCenter={homeCenter}
            territoryPoints={territoryPoints}
          />

          {targetsHighlight &&
            targets
              .filter((target) => !visibleH3.has(target.h3Index))
              .map((target) => {
                try {
                  const boundary = cellBoundary(target.h3Index);
                  return (
                    <MapCellHatchOverlay
                      key={`target-hatch-${target.h3Index}`}
                      h3Index={target.h3Index}
                      boundary={boundary}
                      kind={targetCategoryToHatch(target.category)}
                    />
                  );
                } catch {
                  return null;
                }
              })}

          {siegeFocusActive &&
            Array.from(siegeThreatH3)
              .filter((h3Index) => !visibleH3.has(h3Index))
              .map((h3Index) => {
                try {
                  return (
                    <MapCellHatchOverlay
                      key={`siege-hatch-${h3Index}`}
                      h3Index={h3Index}
                      boundary={cellBoundary(h3Index)}
                      kind="siege"
                    />
                  );
                } catch {
                  return null;
                }
              })}

          {activityFocusActive &&
            Array.from(activityFocusH3).map((h3Index) => {
              try {
                return (
                  <MapCellHatchOverlay
                    key={`run-hatch-${h3Index}`}
                    h3Index={h3Index}
                    boundary={cellBoundary(h3Index)}
                    kind="run"
                    pane="activityFocusPane"
                  />
                );
              } catch {
                return null;
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
                radius={HOME_ZONE_RADIUS_M}
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

          {visibleCells.map((cell) => {
            try {
              const boundary = cellBoundary(cell.h3Index);
              const isMine = cell.ownerId === user?.id;
              const isTarget = targetH3.has(cell.h3Index);
              const isSelected = selectedCell?.h3Index === cell.h3Index;
              const emphasizeMine = isMine && territoryHighlight;
              const emphasizeTarget = isTarget && targetsHighlight;
              const emphasizeSiege = siegeFocusActive && siegeThreatH3.has(cell.h3Index);
              const emphasizeRun = activityFocusActive && activityFocusH3.has(cell.h3Index);

              return (
                <MapCellPolygons
                  key={cell.h3Index}
                  cell={cell}
                  boundary={boundary}
                  userId={user?.id}
                  rivalH3={rivalH3}
                  targetH3={targetH3}
                  targetCategoryByH3={targetCategoryByH3}
                  previewFlash={previewFlash}
                  isSelected={isSelected}
                  emphasizeMine={emphasizeMine}
                  emphasizeTarget={emphasizeTarget}
                  emphasizeSiege={emphasizeSiege}
                  emphasizeRun={emphasizeRun}
                  onSelect={setSelectedCell}
                />
              );
            } catch {
              return null;
            }
          })}

          <CellInfluenceLabels
            cells={visibleCells}
            zoom={mapZoom}
            userId={user?.id}
          />

        </MapContainer>

        <div className="map-chrome">
        <div className="map-float-identity">
          <div className="wire-avatar" />
          <div className="map-float-identity__copy">
            <strong>{user?.nickname || 'runner'}</strong>
            {atSoftCap && <span className="map-float-identity__cap">лимит</span>}
          </div>
        </div>

        <ul
          className={`map-legend${legendOpen ? ' is-open' : ''}`}
          aria-label="Легенда карты"
        >
          {legendItems.map((item) => (
            <li key={item.label}>
              {item.split ? (
                <span className="map-legend-swatch map-legend-swatch--split" />
              ) : (
                <span
                  className={item.dash ? 'map-legend-swatch map-legend-swatch--dash' : 'map-legend-swatch'}
                  style={
                    item.dash
                      ? { borderColor: item.stroke }
                      : { background: item.fill, borderColor: item.stroke }
                  }
                />
              )}
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

        {loading && visibleCells.length === 0 && (
          <div className="map-overlay map-overlay--full">
            Загружаем карту…
          </div>
        )}

        {refreshing && <div className="map-sync-indicator" aria-hidden="true" />}

        {initialLoadDone &&
          myCells.length === 0 &&
          visibleCells.length === 0 &&
          cellsOwned === 0 && (
          <div className="map-empty-state">
            <p><strong>У тебя пока нет клеток</strong></p>
            <p>Загрузи первую пробежку на вкладке «Бег».</p>
          </div>
        )}

        {initialLoadDone &&
          myCells.length === 0 &&
          visibleCells.length === 0 &&
          cellsOwned > 0 &&
          !error && (
          <div className="map-empty-state">
            <p><strong>Клетки не загрузились</strong></p>
            <p>Проверьте, что API и Postgres запущены, затем обновите страницу.</p>
          </div>
        )}

        {previewMessage && (
          <div className="map-focus-banner map-focus-banner--targets" role="status">
            <span>{previewMessage}</span>
            <button type="button" className="ghost-btn small-btn" onClick={dismissPreview}>
              Закрыть
            </button>
          </div>
        )}

        {targetsHighlight && targetsMessage && (
          <div
            className="map-focus-banner map-focus-banner--targets map-focus-banner--passive"
            role="status"
          >
            <span>{targetsMessage}</span>
          </div>
        )}

        {siegeFocusActive && (
          <div
            className="map-focus-banner map-focus-banner--siege map-focus-banner--passive"
            role="status"
          >
            <span>
              {siegeThreatH3.size > 1
                ? `${siegeThreatH3.size} ${cellsWord(siegeThreatH3.size)} под атакой`
                : `Клетка под атакой${siegeChallengerNickname ? ` от ${siegeChallengerNickname}` : ''}`}
            </span>
          </div>
        )}

        {activityFocusActive && activityFocusH3.size > 0 && (
          <div
            className="map-focus-banner map-focus-banner--run map-focus-banner--passive"
            role="status"
          >
            <span>
              {activityFocusH3.size} {cellsWord(activityFocusH3.size)} на маршруте пробежки
            </span>
          </div>
        )}

        <div className="map-action-dock" aria-label="Быстрые действия карты">
          <button
            type="button"
            className="map-action-dock__icon"
            aria-label="Справка по карте"
            onClick={() => setShowMapGuide(true)}
          >
            ?
          </button>
          <button
            type="button"
            className={legendOpen ? 'is-active' : undefined}
            aria-label={legendOpen ? 'Скрыть легенду' : 'Показать легенду'}
            aria-pressed={legendOpen}
            onClick={() => setLegendOpen((open) => !open)}
          >
            Цвета
          </button>
          <span className="map-action-dock__sep" aria-hidden="true" />
          <button type="button" onClick={flyTerritory} disabled={myCells.length === 0}>
            Территория
          </button>
          <button type="button" onClick={flyHome} disabled={homeCenter == null}>
            Дом
          </button>
          <button
            type="button"
            className={missionCount > 0 ? 'map-action-dock__primary' : undefined}
            onClick={() => void handleFindTargets()}
            disabled={findingTargets}
          >
            {targetsButtonLabel}
          </button>
        </div>

        <aside className="map-desktop-rail" aria-label="Задачи и статус">
          {siegeVisible && siegeChipLabel && (
            <button
              type="button"
              className={`map-rail-alert map-rail-alert--siege${gapPercent != null && gapPercent >= 80 ? ' map-rail-alert--urgent' : ''}`}
              onClick={focusSiegeOnMap}
            >
              <span className="map-rail-alert__icon" aria-hidden="true">
                ⚠
              </span>
              <span className="map-rail-alert__text">
                {siegeChipLabel}
                {siegeThreatH3.size > 1 && (
                  <span className="chip-count">+{siegeThreatH3.size - 1}</span>
                )}
              </span>
            </button>
          )}

          <div className="map-rail-hero">
            <p className="map-rail-hero__stat">
              <span className="map-rail-hero__value">{cellsOwned}</span>
              <span className="map-rail-hero__label">{cellsWord(cellsOwned)}</span>
            </p>
            {currentStreak > 0 && (
              <div className="map-rail-hero__streak">
                <StreakBadge streak={currentStreak} />
                {streakInfo.nextMilestone != null && streakInfo.tier === 'none' && (
                  <span className="map-rail-hero__streak-hint">
                    ×{streakMultiplier(streakInfo.nextMilestone).toFixed(1)} через{' '}
                    {streakInfo.nextMilestone - currentStreak} дн
                  </span>
                )}
              </div>
            )}
          </div>

          {todayMissionsLine && (
            <div className="map-rail-mission">
              <span className="map-rail-mission__label">Сегодня</span>
              <p className="map-rail-mission__text">{todayMissionsLine}</p>
              <button
                type="button"
                className="primary-btn small-btn map-rail-mission__cta"
                onClick={() => void handleFindTargets()}
                disabled={findingTargets}
              >
                {findingTargets ? 'Поиск…' : 'На карте'}
              </button>
            </div>
          )}

          {weeklyReport && <WeeklyReportCard report={weeklyReport} compact />}

          {cellsNeedingRun > 0 && (
            <button type="button" className="map-rail-alert map-rail-alert--decay" onClick={focusStaleCells}>
              <span className="map-rail-alert__icon" aria-hidden="true">
                ⏱
              </span>
              <span className="map-rail-alert__text">
                {cellsNeedingRun} {cellsWord(cellsNeedingRun)} без пробежки
              </span>
            </button>
          )}
        </aside>
        </div>
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
        </div>
      </div>

      <CellBottomSheet cell={selectedCell} onClose={closeCellSheet} />
    </div>
  );
}
