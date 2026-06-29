import { useCallback, useEffect, useRef } from 'react';
import { apiRequest } from '../api/client';
import type { FeedEvent } from '../api/types';
import { buildSiegeNotificationText } from '../utils/siege-notification';

const STORAGE_KEY = 'tr_siege_notifications';
const POLL_MS = 60_000;

export function readSiegeNotificationsEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function writeSiegeNotificationsEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}

export async function requestSiegeNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') {
    return false;
  }
  const permission = await Notification.requestPermission();
  const granted = permission === 'granted';
  writeSiegeNotificationsEnabled(granted);
  return granted;
}

export function useSiegeNotificationPolling(
  userId?: string,
  homeLat?: number | null,
  homeLng?: number | null,
) {
  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const poll = useCallback(async () => {
    if (!userId || !readSiegeNotificationsEnabled() || typeof Notification === 'undefined') {
      return;
    }
    if (Notification.permission !== 'granted') {
      return;
    }

    try {
      const data = await apiRequest<{ items: FeedEvent[] }>('/feed?limit=15');
      for (const event of data.items) {
        if (event.type !== 'cell_siege' || event.userId !== userId) {
          continue;
        }
        if (seenRef.current.has(event.id)) {
          continue;
        }
        seenRef.current.add(event.id);
        if (!initializedRef.current) {
          continue;
        }
        const { title, body } = buildSiegeNotificationText(
          event,
          userId,
          homeLat,
          homeLng,
        );
        new Notification(title, {
          body,
          tag: `siege-${event.id}`,
        });
      }
      initializedRef.current = true;
    } catch {
      // ignore polling errors
    }
  }, [userId, homeLat, homeLng]);

  useEffect(() => {
    if (!userId || !readSiegeNotificationsEnabled()) {
      return;
    }
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [userId, poll]);
}
