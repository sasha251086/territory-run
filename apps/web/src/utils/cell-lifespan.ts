import {

  DECAY_DELETE_AFTER_DAYS,

  DECAY_GRACE_DAYS,

  DECAY_PERCENT_PER_DAY,

  DECAY_THREAT_DAYS,

  dailyDecayLossFromInfluence,

  displayInfluence,

  MAX_INFLUENCE_DISPLAY,

} from '../constants/game';



export type FreshnessStatus = 'fresh' | 'warning' | 'critical';



export function freshnessLabel(status: FreshnessStatus): string {

  switch (status) {

    case 'fresh':

      return 'Без ослабления';

    case 'warning':

      return 'Нужна пробежка';

    case 'critical':

      return 'Срочно';

  }

}



export function formatInfluenceValue(internal: number): string {

  return String(displayInfluence(internal));

}



export function influenceProgressPct(internal: number): number {

  return Math.min(100, Math.round((displayInfluence(internal) / MAX_INFLUENCE_DISPLAY) * 100));

}



export function daysSinceActivityFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / (24 * 60 * 60 * 1000));
}

export function resolveDaysSinceMyActivity(
  daysSince: number | null | undefined,
  ...isoDates: Array<string | null | undefined>
): number | null {
  if (daysSince != null && Number.isFinite(daysSince)) {
    return daysSince;
  }
  for (const iso of isoDates) {
    const computed = daysSinceActivityFromIso(iso);
    if (computed != null) {
      return computed;
    }
  }
  return null;
}

export function daysAgoShort(daysSince: number | null | undefined): string {

  if (daysSince == null) return '—';

  if (daysSince === 0) return 'Сегодня';

  if (daysSince === 1) return 'Вчера';

  return `${daysSince} дн.`;

}



export function daysAgoLabel(daysSince: number | null | undefined): string {

  if (daysSince == null) return 'Визита ещё не было';

  if (daysSince === 0) return 'Сегодня';

  if (daysSince === 1) return 'Вчера';

  if (daysSince % 10 === 1 && daysSince % 100 !== 11) {

    return `${daysSince} день назад`;

  }

  if (daysSince % 10 >= 2 && daysSince % 10 <= 4 && (daysSince % 100 < 10 || daysSince % 100 >= 20)) {

    return `${daysSince} дня назад`;

  }

  return `${daysSince} дней назад`;

}



/** @deprecated */

export function lastRunLabel(daysSince: number | null | undefined): string {

  return daysAgoLabel(daysSince);

}



export function graceDaysLeft(daysSince: number | null | undefined): number | null {

  if (daysSince == null) return null;

  return Math.max(0, DECAY_GRACE_DAYS - daysSince);

}



/** 0 = только что бегали, 100 = льгота почти или уже исчерпана. */

export function visitFreshnessBarPct(

  daysSince: number | null | undefined,

  freshness: FreshnessStatus,

  influence?: number | null,

): number {

  if (daysSince == null) {

    if (influence != null && influence > 0) {

      return 12;

    }

    return 0;

  }

  if (freshness === 'fresh') {

    return Math.min(100, Math.round((daysSince / DECAY_GRACE_DAYS) * 100));

  }

  if (freshness === 'warning') {

    const intoWarning = Math.max(0, daysSince - DECAY_GRACE_DAYS);

    const warningSpan = Math.max(1, DECAY_THREAT_DAYS - DECAY_GRACE_DAYS);

    return Math.min(100, 55 + Math.round((intoWarning / warningSpan) * 45));

  }

  return 100;

}



function formatDecayLossLine(dailyLoss: number, influence?: number | null): string {

  const loss =

    dailyLoss > 0

      ? dailyLoss

      : influence != null && influence > 0

        ? dailyDecayLossFromInfluence(influence)

        : 0;

  if (loss > 0) {

    return `−${DECAY_PERCENT_PER_DAY}% (−${displayInfluence(loss)}/день)`;

  }

  return `−${DECAY_PERCENT_PER_DAY}% в день`;

}



export function visitFreshnessCaption(

  daysSince: number | null | undefined,

  freshness: FreshnessStatus,

  dailyLoss: number,

  daysUntilWipe: number | null | undefined,

  influence?: number | null,

): string {

  const decayLine = formatDecayLossLine(dailyLoss, influence);



  if (freshness === 'fresh') {

    const left = graceDaysLeft(daysSince);

    if (daysSince == null) {

      if (influence != null && influence > 0) {

        return 'Дата последней пробежки неизвестна — пройдите клетку снова';

      }

      return 'Пробегитесь здесь, чтобы оставить след';

    }

    if (left === 0) return `Завтра ${decayLine.toLowerCase()}`;

    if (left === 1) return '1 день до ослабления';

    return `${left} дн. до ослабления`;

  }



  if (freshness === 'warning') {

    return decayLine;

  }



  if (daysUntilWipe != null) {

    return `${decayLine} · ${daysUntilWipe} дн. до пропажи`;

  }



  return `${decayLine} · срочно`;

}



export function cellsWord(count: number): string {

  if (count % 10 === 1 && count % 100 !== 11) return 'клетка';

  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {

    return 'клетки';

  }

  return 'клеток';

}



export { DECAY_DELETE_AFTER_DAYS, DECAY_GRACE_DAYS, DECAY_PERCENT_PER_DAY, MAX_INFLUENCE_DISPLAY };


