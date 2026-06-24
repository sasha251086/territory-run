const DECAY_WARNING_DAYS = 7;
const DECAY_CRITICAL_DAYS = 11;
const DECAY_DELETE_AFTER_DAYS = 14;

export type DecayCounts = {
  warning: number;
  danger: number;
  minDaysToDelete: number | null;
};

export function countDecayCells(
  cells: { daysSinceMyActivity?: number | null }[],
): DecayCounts {
  let warning = 0;
  let danger = 0;
  let minDaysToDelete: number | null = null;

  for (const cell of cells) {
    const days = cell.daysSinceMyActivity;
    if (days == null) continue;
    if (days >= DECAY_CRITICAL_DAYS && days < DECAY_DELETE_AFTER_DAYS) {
      danger += 1;
      const left = DECAY_DELETE_AFTER_DAYS - days;
      if (minDaysToDelete == null || left < minDaysToDelete) {
        minDaysToDelete = left;
      }
    } else if (days >= DECAY_WARNING_DAYS && days < DECAY_CRITICAL_DAYS) {
      warning += 1;
    }
  }

  return { warning, danger, minDaysToDelete };
}

export function findNearestDecayCell(
  cells: MapCellLike[],
): MapCellLike | null {
  let best: MapCellLike | null = null;
  let bestDays = -1;

  for (const cell of cells) {
    const days = cell.daysSinceMyActivity;
    if (days == null || days < DECAY_WARNING_DAYS) continue;
    if (days > bestDays) {
      bestDays = days;
      best = cell;
    }
  }

  return best;
}

type MapCellLike = {
  daysSinceMyActivity?: number | null;
  lat: number | null;
  lng: number | null;
  h3Index: string;
};

export const DECAY_TOAST_KEY = 'territory-run-decay-toast-date';

export function shouldShowDecayToast(dangerCount: number): boolean {
  if (dangerCount === 0) return false;
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem(DECAY_TOAST_KEY);
  if (last === today) return false;
  localStorage.setItem(DECAY_TOAST_KEY, today);
  return true;
}

export { DECAY_CRITICAL_DAYS, DECAY_WARNING_DAYS, DECAY_DELETE_AFTER_DAYS };
