import type { MapCell, MapSummary } from '../api/types';
import { freshnessStatus } from './cell-freshness';

export function countTerritoryFreshness(cells: MapCell[]): {
  cellsFresh: number;
  cellsWarning: number;
  cellsCritical: number;
} {
  let cellsFresh = 0;
  let cellsWarning = 0;
  let cellsCritical = 0;

  for (const cell of cells) {
    const status = freshnessStatus(cell.myLastActivityAt ?? cell.lastActivityAt);
    if (status === 'fresh') {
      cellsFresh += 1;
    } else if (status === 'warning') {
      cellsWarning += 1;
    } else {
      cellsCritical += 1;
    }
  }

  return { cellsFresh, cellsWarning, cellsCritical };
}

/** Fills territory counts when production API omits freshness breakdown. */
export function enrichMapSummary(
  summary: MapSummary,
  cells: MapCell[],
  cellsOwned: number,
): MapSummary {
  const reported =
    (summary.cellsFresh ?? 0) +
    (summary.cellsWarning ?? 0) +
    (summary.cellsCritical ?? 0);

  if (reported > 0 || cellsOwned === 0) {
    return summary;
  }

  const source = cells.length > 0 ? cells : [];
  if (source.length === 0) {
    return summary;
  }

  const counts = countTerritoryFreshness(source);
  return {
    ...summary,
    ...counts,
    cellsAtRisk: counts.cellsCritical,
  };
}
