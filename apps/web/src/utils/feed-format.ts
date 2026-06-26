import type { FeedEvent } from '../api/types';
import { cellCountWord, formatCellCount } from './territory';

export function formatFeedEvent(event: FeedEvent, viewerUserId?: string): string {
  const payload = event.payload;

  switch (event.type) {
    case 'activity_completed': {
      if (payload.flagged) {
        return 'пробежка отклонена проверкой GPS';
      }
      const cellsCaptured = Number(payload.cellsCaptured ?? payload.cellsAffected ?? 0);
      const km = Number(payload.distance ?? 0) / 1000;
      if (km <= 0) {
        return `затронуто ${formatCellCount(cellsCaptured)}`;
      }
      const pvp = Number(payload.pvpCaptures ?? 0);
      const base = `пробежал ${km.toFixed(1)} км · захвачено ${formatCellCount(cellsCaptured)}`;
      if (pvp > 0) {
        return `${base} (${pvp} у соперников)`;
      }
      return base;
    }
    case 'cell_captured': {
      const prev = payload.previousOwnerNickname as string | null;
      if (prev) {
        return `захватил клетку у ${prev}`;
      }
      return 'захватил новую клетку';
    }
    case 'district_captured': {
      const name = (payload.districtName as string) || 'район';
      return `стал королём района «${name}»`;
    }
    case 'cell_siege': {
      const challenger = (payload.challengerNickname as string) || 'Соперник';
      const gap = Number(payload.gapPercent ?? 0);
      if (viewerUserId && event.userId === viewerUserId) {
        return `Осада: ${challenger} догоняет вашу клетку (${gap}% до захвата)`;
      }
      return `Осада: ${challenger} атакует клетку ${event.user.nickname} (${gap}%)`;
    }
    default:
      return event.type.replace(/_/g, ' ');
  }
}

export function formatFeedRowClass(event: FeedEvent): string {
  if (event.type === 'cell_siege') {
    return 'feed-row feed-row--siege';
  }
  if (event.type === 'activity_completed' && event.payload.flagged) {
    return 'feed-row feed-row--error';
  }
  return 'feed-row';
}

export function formatFeedBadgeClass(event: FeedEvent): string {
  if (event.type === 'cell_siege') {
    return 'wire-badge wire-badge--siege';
  }
  if (event.type === 'activity_completed' && event.payload.flagged) {
    return 'wire-badge wire-badge--error';
  }
  return 'wire-badge';
}

export function formatFeedBadge(event: FeedEvent): string | null {
  const payload = event.payload;

  switch (event.type) {
    case 'activity_completed': {
      if (payload.flagged) return 'ERR';
      const cellsCaptured = Number(
        payload.cellsCaptured ?? payload.cellsAffected ?? 0,
      );
      if (cellsCaptured <= 0) {
        return null;
      }
      return `+${cellsCaptured} ${cellCountWord(cellsCaptured).toUpperCase()}`;
    }
    case 'cell_captured':
      return '+1 КЛЕТКА';
    case 'district_captured':
      return 'король';
    case 'cell_siege':
      return 'осада';
    default:
      return null;
  }
}
