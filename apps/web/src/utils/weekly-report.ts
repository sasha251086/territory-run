import type { MapSummary, RegionalLeaderboardResponse, WeeklyReport } from '../api/types';
import { formatCellCount } from './territory';

type WeeklyReportContext = {
  userId?: string;
  regional?: RegionalLeaderboardResponse | null;
};

function cellsWordRu(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'клетка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'клетки';
  return 'клеток';
}

function appendRegionalHeadline(
  headline: string,
  context: WeeklyReportContext | undefined,
  cellsGained: number,
): string {
  const regional = context?.regional;
  const userId = context?.userId;
  if (!regional || regional.noHomeBase || !userId || regional.items.length === 0) {
    return headline;
  }

  const myIndex = regional.items.findIndex((item) => item.userId === userId);
  if (myIndex < 0) {
    return headline;
  }

  if (myIndex === 0 && regional.items.length > 1 && cellsGained > 0) {
    return `${headline} · лучший темп в районе`;
  }

  if (myIndex > 0) {
    const above = regional.items[myIndex - 1]!;
    const gap = above.value - (regional.items[myIndex]?.value ?? 0);
    if (gap > 0) {
      return `${headline} · до ${above.nickname}: ${gap} ${cellsWordRu(gap)}`;
    }
  }

  return headline;
}

export function resolveWeeklyReport(
  summary: MapSummary | null,
  context?: WeeklyReportContext,
): WeeklyReport | null {
  if (!summary) {
    return null;
  }
  if (summary.weeklyReport) {
    return summary.weeklyReport;
  }

  const cellsGained = summary.cellsGainedThisWeek ?? 0;
  const progress = summary.weeklyProgressPercent ?? 0;
  const weeklyGoal =
    progress > 0 && cellsGained > 0
      ? Math.max(cellsGained, Math.round((cellsGained / progress) * 100))
      : Math.max(5, cellsGained || 5);

  const baseHeadline =
    cellsGained > 0
      ? `+${formatCellCount(cellsGained)} за неделю`
      : 'Пока без новых клеток за неделю';

  return {
    cellsGained,
    weeklyGoal,
    progressPercent: progress,
    headline: appendRegionalHeadline(baseHeadline, context, cellsGained),
  };
}
