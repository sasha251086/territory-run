import type { FeedEvent } from '../api/types';

import { formatFeedBadge, formatFeedBadgeClass, formatFeedEvent, formatFeedRowClass } from './feed-format';

import { formatCellCount } from './territory';



export type FeedListEntry =

  | { kind: 'event'; event: FeedEvent }

  | { kind: 'group'; key: string; user: FeedEvent['user']; events: FeedEvent[] }

  | { kind: 'siege'; key: string; user: FeedEvent['user']; events: FeedEvent[] };



function sameDay(a: Date, b: Date): boolean {

  return (

    a.getFullYear() === b.getFullYear() &&

    a.getMonth() === b.getMonth() &&

    a.getDate() === b.getDate()

  );

}



function groupLabel(events: FeedEvent[]): string {

  const runs = events.length;

  let cells = 0;

  let distance = 0;

  let pvp = 0;



  for (const event of events) {

    if (event.type !== 'activity_completed') {

      continue;

    }

    const payload = event.payload as Record<string, unknown>;

    cells += Number(payload.cellsCaptured ?? payload.cellsAffected ?? 0);

    distance += Number(payload.distance ?? 0);

    pvp += Number(payload.pvpCaptures ?? 0);

  }



  const km = distance / 1000;

  const parts = [`${runs} ${runs === 1 ? 'пробежка' : runs < 5 ? 'пробежки' : 'пробежек'}`];

  if (km > 0) {

    parts.push(`${km.toFixed(1)} км`);

  }

  if (cells > 0) {

    parts.push(`+${formatCellCount(cells)}`);

  }

  if (pvp > 0) {

    parts.push(`${pvp} у соперников`);

  }

  return parts.join(' · ');

}



function siegeDefenderKey(event: FeedEvent): string | null {

  if (event.type !== 'cell_siege') {

    return null;

  }

  return event.userId;

}



function sortSiegesNewestFirst(events: FeedEvent[]): FeedEvent[] {

  return [...events].sort(

    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),

  );

}



export function siegeHistoryLine(event: FeedEvent): string {

  const gap = Number(event.payload.gapPercent ?? 0);

  const time = new Date(event.createdAt).toLocaleString('ru-RU', {

    day: 'numeric',

    month: 'short',

    hour: '2-digit',

    minute: '2-digit',

  });

  return `${gap}% · ${time}`;

}



/** Диапазон процента осады по нескольким клеткам одного игрока. */

export function formatSiegeGapRange(events: FeedEvent[]): string {

  const gaps = events.map((event) => Number(event.payload.gapPercent ?? 0));

  if (gaps.length <= 1) {

    return `${gaps[0] ?? 0}%`;

  }

  const min = Math.min(...gaps);

  const max = Math.max(...gaps);

  if (min === max) {

    return `${max}%`;

  }

  return `${min}% → ${max}%`;

}



export function formatSiegeGroupSummary(events: FeedEvent[], viewerUserId?: string): string {

  const sorted = sortSiegesNewestFirst(events);

  const latest = sorted[0]!;

  const count = sorted.length;

  const gapText = formatSiegeGapRange(sorted);

  const challenger = String(latest.payload.challengerNickname ?? 'Соперник');



  if (count === 1) {

    return formatFeedEvent(latest, viewerUserId);

  }



  const cellsLabel = formatCellCount(count);

  if (viewerUserId && latest.userId === viewerUserId) {

    return `${cellsLabel} под осадой от ${challenger} (${gapText})`;

  }

  return `${challenger} атакует ${cellsLabel} у ${latest.user.nickname} (${gapText})`;

}



export function buildFeedList(items: FeedEvent[]): FeedListEntry[] {

  const siegesByDefender = new Map<string, FeedEvent[]>();

  for (const event of items) {

    if (event.type !== 'cell_siege') {

      continue;

    }

    const key = siegeDefenderKey(event);

    if (!key) {

      continue;

    }

    const group = siegesByDefender.get(key) ?? [];

    group.push(event);

    siegesByDefender.set(key, group);

  }



  const emittedSiegeDefenders = new Set<string>();

  const result: FeedListEntry[] = [];

  let index = 0;



  while (index < items.length) {

    const event = items[index];



    if (event.type === 'cell_siege') {

      const defenderKey = siegeDefenderKey(event);

      if (defenderKey && emittedSiegeDefenders.has(defenderKey)) {

        index += 1;

        continue;

      }



      if (defenderKey) {

        emittedSiegeDefenders.add(defenderKey);

        const events = sortSiegesNewestFirst(siegesByDefender.get(defenderKey) ?? [event]);

        if (events.length > 1) {

          result.push({

            kind: 'siege',

            key: `siege-${defenderKey}`,

            user: event.user,

            events,

          });

        } else {

          result.push({ kind: 'event', event });

        }

      } else {

        result.push({ kind: 'event', event });

      }



      index += 1;

      continue;

    }



    if (event.type !== 'activity_completed') {

      result.push({ kind: 'event', event });

      index += 1;

      continue;

    }



    const groupEvents: FeedEvent[] = [event];

    const startedAt = new Date(event.createdAt);

    let next = index + 1;



    while (next < items.length) {

      const candidate = items[next];

      if (

        candidate.type === 'activity_completed' &&

        candidate.userId === event.userId &&

        sameDay(new Date(candidate.createdAt), startedAt)

      ) {

        groupEvents.push(candidate);

        next += 1;

        continue;

      }

      break;

    }



    if (groupEvents.length > 1) {

      result.push({

        kind: 'group',

        key: `${event.userId}-${startedAt.toISOString().slice(0, 10)}-${index}`,

        user: event.user,

        events: groupEvents,

      });

    } else {

      result.push({ kind: 'event', event });

    }



    index = next;

  }



  return result;

}



export {

  formatFeedBadge,

  formatFeedBadgeClass,

  formatFeedEvent,

  formatFeedRowClass,

  groupLabel,

};

