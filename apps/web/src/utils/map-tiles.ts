/** Shared map tile config — Voyager: readable city/district labels, lighter than dark_all */
export const MAP_TILE = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
} as const;

/** Fixed fill color for owned cells — gradation is opacity-only */
export const OWN_CELL_COLOR = '#3ecfb8';

export function myInfluenceValue(cell: { myInfluence?: number; influence: number }): number {
  return cell.myInfluence ?? cell.influence ?? 0;
}

export function computeInfluenceRange(cells: { myInfluence?: number; influence: number }[]): {
  min: number;
  max: number;
} {
  if (cells.length === 0) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const cell of cells) {
    const v = myInfluenceValue(cell);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) return { min: 0, max: Math.max(max, 1) };
  return { min, max };
}

/** More influence → less transparent (higher opacity). Color stays constant. */
export function ownedCellAppearance(
  cell: { myInfluence?: number; influence: number },
  range: { min: number; max: number },
): { fillColor: string; strokeColor: string; fillOpacity: number } {
  const value = myInfluenceValue(cell);
  const span = range.max - range.min;
  let t = span > 0 ? (value - range.min) / span : 1;
  t = Math.pow(Math.max(0, Math.min(1, t)), 0.75);

  const fillOpacity = 0.28 + t * 0.54;

  return {
    fillColor: OWN_CELL_COLOR,
    strokeColor: OWN_CELL_COLOR,
    fillOpacity,
  };
}