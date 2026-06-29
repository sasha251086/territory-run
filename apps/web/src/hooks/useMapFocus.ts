import { useCallback, useRef, useState } from 'react';
import type { LatLngExpression } from 'leaflet';
import { cellToLatLng } from 'h3-js';
import type { MapCell } from '../api/types';
import { isStaleCell } from '../utils/map-cell-visual';

export type FlyMode = 'home' | 'territory' | 'targets';

export type FlyRequest = {
  mode: FlyMode;
  trigger: number;
  points?: LatLngExpression[];
};

export const ACTIVITY_FOCUS_GRACE_MS = 700;

function cellCenter(cell: MapCell): [number, number] {
  if (cell.lat != null && cell.lng != null) {
    return [cell.lat, cell.lng];
  }
  const [lat, lng] = cellToLatLng(cell.h3Index);
  return [lat, lng];
}

export function useMapFocus(
  myCells: MapCell[],
  userId: string | undefined,
  siegeThreatH3: Set<string>,
) {
  const [flyRequest, setFlyRequest] = useState<FlyRequest | null>(null);
  const [territoryHighlight, setTerritoryHighlight] = useState(false);
  const [siegeFocusActive, setSiegeFocusActive] = useState(false);
  const [activityFocusH3, setActivityFocusH3] = useState<Set<string>>(() => new Set());
  const [activityFocusActive, setActivityFocusActive] = useState(false);
  const [previewFlash, setPreviewFlash] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);

  const flyTriggerRef = useRef(0);
  const activityFocusGraceUntilRef = useRef(0);

  const queueFly = useCallback((mode: FlyMode, points?: LatLngExpression[]) => {
    flyTriggerRef.current += 1;
    setFlyRequest({ mode, trigger: flyTriggerRef.current, points });
  }, []);

  const flyHome = useCallback(() => {
    setTerritoryHighlight(false);
    queueFly('home');
  }, [queueFly]);

  const flyTerritory = useCallback(() => {
    setTerritoryHighlight(true);
    queueFly('territory');
  }, [queueFly]);

  const focusStaleCells = useCallback(() => {
    setTerritoryHighlight(true);
    const stalePoints = myCells
      .filter((cell) => isStaleCell(cell, userId))
      .map((cell) => cellCenter(cell) as LatLngExpression);
    if (stalePoints.length > 0) {
      queueFly('territory', stalePoints);
    }
  }, [myCells, queueFly, userId]);

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

  const dismissPreview = useCallback(() => {
    setPreviewMessage(null);
    setPreviewFlash(false);
  }, []);

  const focusSiegeOnMap = useCallback(
    (dismissTargets: () => void) => {
      dismissTargets();
      dismissActivityFocus();
      setTerritoryHighlight(false);
      setPreviewMessage(null);
      setPreviewFlash(false);
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
            // skip
          }
        }
      }
      if (points.length > 0) {
        queueFly('targets', points);
      }
    },
    [dismissActivityFocus, myCells, queueFly, siegeThreatH3],
  );

  const armActivityFocus = useCallback((h3Set: Set<string>) => {
    setActivityFocusH3(h3Set);
    setActivityFocusActive(h3Set.size > 0);
    if (h3Set.size > 0) {
      activityFocusGraceUntilRef.current = Date.now() + ACTIVITY_FOCUS_GRACE_MS;
    }
  }, []);

  return {
    flyRequest,
    flyTriggerRef,
    territoryHighlight,
    setTerritoryHighlight,
    siegeFocusActive,
    setSiegeFocusActive,
    activityFocusH3,
    activityFocusActive,
    previewFlash,
    setPreviewFlash,
    previewMessage,
    setPreviewMessage,
    queueFly,
    flyHome,
    flyTerritory,
    focusStaleCells,
    focusSiegeOnMap,
    dismissSiegeFocus,
    dismissActivityFocus,
    dismissPreview,
    armActivityFocus,
  };
}
