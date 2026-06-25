import type { FeedEvent } from '../api/types';

export function formatFeedEvent(event: FeedEvent, viewerUserId?: string): string {
  const payload = event.payload;

  switch (event.type) {
    case 'activity_completed': {
      if (payload.flagged) {
        return 'пробежка отклонена проверкой GPS';
      }
      const cells = Number(payload.cellsAffected ?? 0);
      const km = Number(payload.distance ?? 0) / 1000;
      return `пробежал ${km.toFixed(1)} км · затронуто ${cells} клеток`;
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
        return `${challenger} атакует твою клетку — ${gap}% до захвата`;
      }
      return `${challenger} атакует клетку ${event.user.nickname} — ${gap}% до захвата`;
    }
    default:
      return event.type.replace(/_/g, ' ');
  }
}

export function formatFeedBadge(event: FeedEvent): string | null {
  const payload = event.payload;

  switch (event.type) {
    case 'activity_completed': {
      if (payload.flagged) return 'ERR';
      const cells = Number(payload.cellsAffected ?? 0);
      return cells > 0 ? `+${cells} клеток` : null;
    }
    case 'cell_captured':
      return '+1 клетка';
    case 'district_captured':
      return 'король';
    case 'cell_siege':
      return 'осада';
    default:
      return null;
  }
}
