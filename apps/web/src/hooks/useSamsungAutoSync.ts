import { useCallback, useEffect, useRef } from 'react';
import { apiRequest } from '../api/client';
import {
  formatHealthSyncMessage,
  healthSync,
  runHealthSyncImport,
} from '../services/health-sync.service';

const ENABLED_KEY = 'tr_samsung_auto_sync';
const LAST_SYNC_KEY = 'tr_samsung_auto_sync_at';
/** Do not hammer Samsung Health / API on every app resume. */
const MIN_INTERVAL_MS = 30 * 60 * 1000;

export function readSamsungAutoSyncEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1';
}

export function writeSamsungAutoSyncEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
}

function readLastAutoSyncAt(): number {
  const raw = localStorage.getItem(LAST_SYNC_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeLastAutoSyncAt(ms: number) {
  localStorage.setItem(LAST_SYNC_KEY, String(ms));
}

export async function enableSamsungAutoSync(): Promise<boolean> {
  const granted = await healthSync.requestPermissions();
  if (!granted) {
    return false;
  }
  writeSamsungAutoSyncEnabled(true);
  return true;
}

async function runAutoSyncIfDue(): Promise<void> {
  if (!readSamsungAutoSyncEnabled()) {
    return;
  }
  if (!healthSync.isNativeApp() || !healthSync.isAndroid()) {
    return;
  }

  const now = Date.now();
  if (now - readLastAutoSyncAt() < MIN_INTERVAL_MS) {
    return;
  }

  const outcome = await runHealthSyncImport({ days: 14 });
  writeLastAutoSyncAt(now);

  if (!outcome.ok) {
    if (outcome.reason === 'consent_required') {
      console.info('Samsung auto-sync: skipped (Health Connect needs manual consent)');
    }
    return;
  }

  const { result } = outcome;
  if (result.imported > 0) {
    console.info('Samsung auto-sync:', formatHealthSyncMessage(result));
    try {
      const latest = await apiRequest<{
        items: Array<{ id: string; status: string }>;
      }>('/activities?page=1&limit=3');
      const processing = latest.items.find((item) => item.status === 'processing');
      if (processing) {
        window.dispatchEvent(
          new CustomEvent('territory-run:activity-processing', {
            detail: { activityId: processing.id },
          }),
        );
      }
    } catch {
      // non-blocking
    }
  }
}

/** Background Samsung Health import when user enabled auto-sync in profile. */
export function useSamsungAutoSync(userId?: string) {
  const runningRef = useRef(false);

  const trySync = useCallback(async () => {
    if (!userId || runningRef.current) {
      return;
    }
    runningRef.current = true;
    try {
      await runAutoSyncIfDue();
    } finally {
      runningRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !readSamsungAutoSyncEnabled()) {
      return;
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void trySync();
      }
    };

    const bootTimer = window.setTimeout(() => void trySync(), 2500);

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(bootTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, trySync]);
}
