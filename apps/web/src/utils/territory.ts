import { getHexagonAreaAvg } from 'h3-js';

const H3_RESOLUTION = 9;
const CELL_AREA_M2 = getHexagonAreaAvg(H3_RESOLUTION, 'm2');

export function cellsToAreaM2(cells: number): number {
  return cells * CELL_AREA_M2;
}

export function formatAreaM2(m2: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(m2))} m²`;
}

export function formatCellCount(cells: number): string {
  const rounded = Math.round(cells);
  const formatted = new Intl.NumberFormat('ru-RU').format(rounded);
  return `${formatted} ${cellCountWord(rounded)}`;
}

export function cellCountWord(cells: number): string {
  const rounded = Math.round(cells);
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return 'клетка';
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'клетки';
  }
  return 'клеток';
}

export function formatCellsCapturedBadge(cells: number): string | null {
  if (cells <= 0) {
    return null;
  }
  return `+${cells} ${cellCountWord(cells)}`;
}

export function formatCellsArea(cells: number): string {
  return formatAreaM2(cellsToAreaM2(cells));
}
