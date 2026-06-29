import { useCallback, useMemo, useState } from 'react';
import type { LatLngExpression } from 'leaflet';
import { apiRequest } from '../api/client';
import type { CaptureTarget } from '../api/types';

type UserHome = { homeLat?: number | null; homeLng?: number | null } | null | undefined;

import type { FlyMode } from '../hooks/useMapFocus';

type FocusActions = {
  dismissActivityFocus: () => void;
  dismissSiegeFocus: () => void;
  setTerritoryHighlight: (value: boolean) => void;
  queueFly: (mode: FlyMode, points?: LatLngExpression[]) => void;
  setError: (message: string | null) => void;
};

export function useMapTargets(
  user: UserHome,
  loadSummary: () => Promise<void>,
  focusActions: FocusActions,
) {
  const [targets, setTargets] = useState<CaptureTarget[]>([]);
  const [targetsHighlight, setTargetsHighlight] = useState(false);
  const [targetsMessage, setTargetsMessage] = useState<string | null>(null);
  const [findingTargets, setFindingTargets] = useState(false);

  const dismissTargets = useCallback(() => {
    setTargets([]);
    setTargetsHighlight(false);
    setTargetsMessage(null);
  }, []);

  const targetH3 = useMemo(() => new Set(targets.map((t) => t.h3Index)), [targets]);

  const targetCategoryByH3 = useMemo(() => {
    const map = new Map<string, CaptureTarget['category']>();
    for (const target of targets) {
      map.set(target.h3Index, target.category);
    }
    return map;
  }, [targets]);

  const handleFindTargets = useCallback(async () => {
    setFindingTargets(true);
    focusActions.setError(null);
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
      focusActions.setTerritoryHighlight(false);
      focusActions.dismissSiegeFocus();
      focusActions.dismissActivityFocus();
      if (data.targets.length > 0) {
        setTargetsHighlight(true);
        void loadSummary();
        focusActions.queueFly(
          'targets',
          data.targets.map((t) => [t.lat, t.lng] as LatLngExpression),
        );
      } else {
        setTargetsHighlight(false);
        focusActions.setError('Рядом нет клеток для захвата — пробегитесь по новому маршруту.');
      }
    } catch (err) {
      setTargetsHighlight(false);
      setTargets([]);
      setTargetsMessage(null);
      focusActions.setError(
        err instanceof Error ? err.message : 'Не удалось найти цели. Укажите домашнюю базу на карте.',
      );
    } finally {
      setFindingTargets(false);
    }
  }, [user?.homeLat, user?.homeLng, focusActions, loadSummary]);

  return {
    targets,
    targetsHighlight,
    targetsMessage,
    findingTargets,
    targetH3,
    targetCategoryByH3,
    handleFindTargets,
    dismissTargets,
    setTargetsHighlight,
  };
}
