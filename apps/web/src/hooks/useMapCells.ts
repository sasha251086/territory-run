import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLngBounds } from 'leaflet';
import L from 'leaflet';
import { cellToLatLng } from 'h3-js';
import { apiRequest } from '../api/client';
import type { MapCell, RivalCell } from '../api/types';
import { isStaleCell } from '../utils/map-cell-visual';

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

function cellCenter(cell: MapCell): [number, number] {
  if (cell.lat != null && cell.lng != null) {
    return [cell.lat, cell.lng];
  }
  const [lat, lng] = cellToLatLng(cell.h3Index);
  return [lat, lng];
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

export function useMapCells(userId: string | undefined, cellsOwned?: number) {
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [nearbyCells, setNearbyCells] = useState<MapCell[]>([]);
  const [myCells, setMyCells] = useState<MapCell[]>([]);
  const [rivalCells, setRivalCells] = useState<RivalCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialCellsLoadRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const fetchFrameRef = useRef<number | null>(null);

  const loadMyCells = useCallback(async () => {
    try {
      const data = await apiRequest<{ cells: MapCell[] }>('/map/cells/mine');
      setMyCells(data.cells);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить ваши клетки');
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
    void loadMyCells();
    void loadRivalCells();
  }, [loadMyCells, loadRivalCells, userId, cellsOwned]);

  useEffect(() => {
    return () => {
      fetchControllerRef.current?.abort();
      if (fetchFrameRef.current != null) {
        cancelAnimationFrame(fetchFrameRef.current);
      }
    };
  }, []);

  const displayCells = useMemo(() => mergeCells(nearbyCells, myCells), [myCells, nearbyCells]);

  const visibleCells = useMemo(() => {
    if (!showStaleOnly) {
      return displayCells;
    }
    return displayCells.filter((cell) => isStaleCell(cell, userId));
  }, [displayCells, showStaleOnly, userId]);

  const visibleH3 = useMemo(() => new Set(visibleCells.map((cell) => cell.h3Index)), [visibleCells]);
  const rivalH3 = useMemo(() => new Set(rivalCells.map((c) => c.h3Index)), [rivalCells]);

  return {
    nearbyCells,
    myCells,
    rivalCells,
    displayCells,
    visibleCells,
    visibleH3,
    rivalH3,
    loading,
    refreshing,
    initialLoadDone,
    error,
    loadMyCells,
    loadRivalCells,
    queueNearbyCellsLoad,
    handleMapInstance,
    setMyCells,
    setError,
    showStaleOnly,
    setShowStaleOnly,
  };
}
