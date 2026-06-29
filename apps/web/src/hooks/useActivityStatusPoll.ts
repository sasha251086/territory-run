import { useCallback, useEffect, useRef } from 'react';
import { apiRequest } from '../api/client';

export type ActivityStatusResult = {
  status: 'processing' | 'completed' | 'failed';
  reason?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  cellsCaptured?: number;
  cellsTouched?: number;
  newCellsCaptured?: number;
  pvpCaptures?: number;
  influenceAdded?: number;
  cellsStillAtRisk?: number;
};

type PollOptions = {
  intervalMs?: number;
  maxAttempts?: number;
  onComplete?: (result: ActivityStatusResult) => void;
  onFailed?: (result: ActivityStatusResult) => void;
};

export function useActivityStatusPoll() {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stopAll = useCallback(() => {
    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => stopAll, [stopAll]);

  const pollActivity = useCallback(
    (activityId: string, options: PollOptions = {}) => {
      stopAll();
      const intervalMs = options.intervalMs ?? 2000;
      const maxAttempts = options.maxAttempts ?? 60;
      let attempts = 0;

      const tick = async () => {
        attempts += 1;
        try {
          const result = await apiRequest<ActivityStatusResult>(
            `/activities/${activityId}/status`,
          );

          if (result.status === 'completed') {
            options.onComplete?.(result);
            return;
          }

          if (result.status === 'failed') {
            options.onFailed?.(result);
            return;
          }
        } catch {
          // keep polling until max attempts
        }

        if (attempts < maxAttempts) {
          const timer = setTimeout(() => void tick(), intervalMs);
          timersRef.current.push(timer);
        }
      };

      void tick();
    },
    [stopAll],
  );

  return { pollActivity, stopPolling: stopAll };
}
