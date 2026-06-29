import type { FeedEvent } from '../api/types';
import { MAINTENANCE_RUN_BADGE } from './run-labels';
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

export function isImportantFeedEvent(event: FeedEvent): boolean {
  if (
    event.type === 'cell_siege' ||
    event.type === 'cell_captured' ||
    event.type === 'district_captured'
  ) {
    return true;
  }

  if (event.type !== 'activity_completed') {
    return false;
  }

  const payload = event.payload;
  if (payload.flagged === true) {
    return true;
  }

  const captured = Number(payload.cellsCaptured ?? payload.cellsAffected ?? 0);
  const pvp = Number(payload.pvpCaptures ?? 0);
  return captured > 0 || pvp > 0;
}

/** Routine run: touched cells but no captures — hidden from default feed views. */
export function isMaintenanceFeedEvent(event: FeedEvent): boolean {
  return event.type === 'activity_completed' && !isImportantFeedEvent(event);
}

export function formatFeedRowClass(event: FeedEvent): string {
  if (event.type === 'cell_siege') {
    return 'feed-row feed-row--siege';
  }
  if (event.type === 'activity_completed' && event.payload.flagged) {
    return 'feed-row feed-row--error';
  }
  if (event.type === 'activity_completed') {
    const captured = Number(
      event.payload.cellsCaptured ?? event.payload.cellsAffected ?? 0,
    );
    const pvp = Number(event.payload.pvpCaptures ?? 0);
    if (captured > 0) {
      return 'feed-row feed-row--capture';
    }
    if (pvp > 0) {
      return 'feed-row feed-row--pvp';
    }
    return 'feed-row feed-row--update';
  }
  if (event.type === 'cell_captured' || event.type === 'district_captured') {
    return 'feed-row feed-row--capture';
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
  if (event.type === 'activity_completed') {
    const captured = Number(
      event.payload.cellsCaptured ?? event.payload.cellsAffected ?? 0,
    );
    const pvp = Number(event.payload.pvpCaptures ?? 0);
    if (captured > 0) {
      return 'wire-badge wire-badge--capture';
    }
    if (pvp > 0) {
      return 'wire-badge wire-badge--pvp';
    }
    return 'wire-badge wire-badge--update';
  }
  if (event.type === 'cell_captured' || event.type === 'district_captured') {
    return 'wire-badge wire-badge--capture';
  }
  return 'wire-badge wire-badge--update';
}

export function formatFeedBadge(event: FeedEvent): string | null {
  const payload = event.payload;

  switch (event.type) {
    case 'activity_completed': {
      if (payload.flagged) return 'ERR';
      const cellsCaptured = Number(
        payload.cellsCaptured ?? payload.cellsAffected ?? 0,
      );
      const pvp = Number(payload.pvpCaptures ?? 0);
      if (cellsCaptured > 0) {
        return `+${cellsCaptured} ${cellCountWord(cellsCaptured).toUpperCase()}`;
      }
      if (pvp > 0) {
        return `${pvp} у соперников`;
      }
      return MAINTENANCE_RUN_BADGE;
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
