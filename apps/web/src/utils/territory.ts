import { getHexagonAreaAvg } from 'h3-js';

const H3_RESOLUTION = 9;
const CELL_AREA_M2 = getHexagonAreaAvg(H3_RESOLUTION, 'm2');

export function cellsToAreaM2(cells: number): number {
  return cells * CELL_AREA_M2;
}

export function formatAreaM2(m2: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(m2))} m²`;
}

export function formatCellsArea(cells: number): string {
  return formatAreaM2(cellsToAreaM2(cells));
}
