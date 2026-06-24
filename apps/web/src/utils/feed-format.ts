import type { FeedEvent } from '../api/types';

export function formatFeedEvent(event: FeedEvent): string {
  const payload = event.payload;

  switch (event.type) {
    case 'activity_completed': {
      if (payload.flagged) {
        return 'пробежка отклонена проверкой GPS';
      }
      const cells = Number(payload.cellsAffected ?? 0);
      const km = Number(payload.distance ?? 0) / 1000;
      if (cells > 0) {
        return `пробежали ${km.toFixed(1)} км, +${cells} клет${cells === 1 ? 'ку' : cells < 5 ? 'ки' : 'ок'}`;
      }
      return `пробежали ${km.toFixed(1)} км`;
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
    default:
      return event.type.replace(/_/g, ' ');
  }
}
