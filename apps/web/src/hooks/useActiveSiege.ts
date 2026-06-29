import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { FeedEvent } from '../api/types';

const DISMISS_KEY = 'tr_siege_chip_dismissed';

export function useActiveSiege(userId?: string) {
  const navigate = useNavigate();
  const [siege, setSiege] = useState<FeedEvent | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(() =>
    sessionStorage.getItem(DISMISS_KEY),
  );

  useEffect(() => {
    if (!userId) {
      setSiege(null);
      return;
    }

    let cancelled = false;
    void apiRequest<{ items: FeedEvent[] }>('/feed?limit=15')
      .then((data) => {
        if (cancelled) {
          return;
        }
        const latest = data.items.find(
          (event) => event.type === 'cell_siege' && event.userId === userId,
        );
        setSiege(latest ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setSiege(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const visible =
    siege != null && siege.id !== dismissedId && dismissedId !== siege.id;

  function openOnMap() {
    if (!siege) {
      return;
    }
    navigate('/?focus=siege');
  }

  function dismiss() {
    if (!siege) {
      return;
    }
    sessionStorage.setItem(DISMISS_KEY, siege.id);
    setDismissedId(siege.id);
  }

  const gapPercent =
    siege != null ? Number(siege.payload.gapPercent ?? 0) : null;

  const challengerNickname =
    siege != null && typeof siege.payload.challengerNickname === 'string'
      ? siege.payload.challengerNickname
      : null;

  const h3Index =
    siege != null && typeof siege.payload.h3Index === 'string'
      ? siege.payload.h3Index
      : null;

  const chipLabel = (() => {
    if (gapPercent == null) {
      return null;
    }
    const name = challengerNickname ?? 'Соперник';
    if (gapPercent >= 80) {
      return `${name} близко — пробегись`;
    }
    return `${name} атакует (${gapPercent}%)`;
  })();

  return {
    siege,
    visible,
    gapPercent,
    challengerNickname,
    h3Index,
    chipLabel,
    openOnMap,
    dismiss,
  };
}
