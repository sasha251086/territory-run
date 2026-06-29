import { cellToLatLng } from 'h3-js';
import type { FeedEvent } from '../api/types';
import { formatDistanceFromHome, haversineKm } from './geo';

export function buildSiegeNotificationText(
  event: FeedEvent,
  viewerUserId: string,
  homeLat?: number | null,
  homeLng?: number | null,
): { title: string; body: string } {
  const payload = event.payload;
  const challenger = String(payload.challengerNickname ?? 'Соперник');
  const gap = Number(payload.gapPercent ?? 0);
  const h3Index = payload.h3Index;

  let distancePart = '';
  if (
    homeLat != null &&
    homeLng != null &&
    typeof h3Index === 'string' &&
    h3Index
  ) {
    try {
      const [lat, lng] = cellToLatLng(h3Index);
      const km = haversineKm(homeLat, homeLng, lat, lng);
      distancePart = `${formatDistanceFromHome(km)} от дома · `;
    } catch {
      // ignore invalid h3
    }
  }

  if (event.userId === viewerUserId) {
    return {
      title: 'Territory Run · Клетка под угрозой',
      body: `${distancePart}${challenger} догоняет (${gap}%)`,
    };
  }

  return {
    title: 'Territory Run · Осада',
    body: `${challenger} атакует клетку ${event.user.nickname} (${gap}%)`,
  };
}
