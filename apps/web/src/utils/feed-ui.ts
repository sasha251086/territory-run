import type { FeedEvent } from '../api/types';
import { formatFeedEvent } from './feed-format';

export function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'сейчас';
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  return `${days} дн`;
}

export type FeedCardVariant = 'teal' | 'red' | 'orange';

export function feedEventVariant(event: FeedEvent, currentUserId?: string): FeedCardVariant {
  if (event.type === 'cell_captured') {
    const prev = event.payload.previousOwnerId as string | undefined;
    if (prev && prev === currentUserId) return 'red';
    return 'orange';
  }
  if (event.type === 'activity_completed') {
    if (event.payload.flagged) return 'orange';
    return event.userId === currentUserId ? 'teal' : 'teal';
  }
  if (event.type === 'district_captured') return 'orange';
  return 'teal';
}

export function feedEventIcon(variant: FeedCardVariant, event: FeedEvent) {
  if (variant === 'red') return '↓';
  if (variant === 'orange') return event.type === 'district_captured' ? '◆' : '!';
  return '↑';
}

export function feedEventAction(
  event: FeedEvent,
  variant: FeedCardVariant,
  currentUserId?: string,
): { label: string; type: 'outline' | 'primary' } | null {
  if (variant === 'red') {
    return { label: 'Отвоевать →', type: 'outline' };
  }
  if (event.type === 'activity_completed' && event.userId === currentUserId && !event.payload.flagged) {
    return { label: 'Поделиться', type: 'primary' };
  }
  return null;
}

export { formatFeedEvent };
