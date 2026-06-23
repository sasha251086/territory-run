import { STREAK_BREAK_DAYS } from './constants';

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function nextStreakState(
  currentStreak: number,
  lastRunDate: Date | null | undefined,
  activityFinishedAt: Date,
): { currentStreak: number; lastRunDate: Date } {
  const runDay = startOfUtcDay(activityFinishedAt);
  const runDate = new Date(runDay);

  if (!lastRunDate) {
    return { currentStreak: 1, lastRunDate: runDate };
  }

  const lastDay = startOfUtcDay(lastRunDate);
  const dayGap = Math.round((runDay - lastDay) / (24 * 60 * 60 * 1000));

  if (dayGap <= 0) {
    return { currentStreak: Math.max(currentStreak, 1), lastRunDate: runDate };
  }

  if (dayGap === 1) {
    return { currentStreak: currentStreak + 1, lastRunDate: runDate };
  }

  if (dayGap === 2) {
    return { currentStreak, lastRunDate: runDate };
  }

  return { currentStreak: 1, lastRunDate: runDate };
}
