import type { MapCell, CaptureTarget } from '../api/types';
import { displayInfluence, MAX_INFLUENCE_PER_CELL } from '../constants/game';

export type CellVisual = {
  fill: string;
  stroke: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWeight: number;
  dashArray?: string;
  contested: boolean;
  freshness: 'none' | 'warning' | 'critical';
};

export const MAP_OWN_FILL = '#459B68';
export const MAP_OWN_STROKE = '#2E7050';
export const MAP_RIVAL_FILL = '#D94A4A';
export const MAP_RIVAL_STROKE = '#AD3232';
export const NEUTRAL_FILL = '#E8F0EB';
export const NEUTRAL_STROKE = '#C4CEC6';
const WARN_STROKE = '#C4A35A';
const CRIT_STROKE = '#9E3535';

const MAX_INTERNAL = MAX_INFLUENCE_PER_CELL;
const VISUAL_CAP = MAX_INFLUENCE_PER_CELL;
const MIN_OPACITY = 0.44;
const MAX_OPACITY = 0.91;

function influenceOpacity(influenceInternal: number): number {
  const clamped = Math.max(0, Math.min(MAX_INTERNAL, influenceInternal));
  if (clamped <= 0) return MIN_OPACITY;
  const normalized = Math.min(1, clamped / VISUAL_CAP);
  return MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * Math.pow(normalized, 0.5);
}

function leaderInfluenceInternal(cell: MapCell): number {
  return cell.influence ?? 0;
}

function targetColors(category: CaptureTarget['category']) {
  if (category === 'defend') return { fill: '#F5D0D0', stroke: MAP_RIVAL_STROKE };
  if (category === 'finish') return { fill: '#F0C890', stroke: '#D09030' };
  if (category === 'expand') return { fill: '#D4E4DC', stroke: MAP_OWN_STROKE };
  return { fill: '#E8D080', stroke: '#C4A35A' };
}

export type ContestedSplit = {
  aDisplay: number;
  bDisplay: number;
  aRatio: number;
  aColor: 'own' | 'rival';
  bColor: 'own' | 'rival';
};

export function getContestedSplit(
  cell: MapCell,
  userId: string | undefined,
): ContestedSplit | null {
  if (!cell.contested) {
    return null;
  }

  const leaderInternal = cell.influence ?? 0;
  const challengerInternal = Math.max(0, leaderInternal - (cell.contestGap ?? 0));
  const myInternal = cell.myInfluence ?? 0;

  if (userId && myInternal > 0) {
    const aValue = myInternal;
    const oppInternal = cell.ownerId === userId ? challengerInternal : leaderInternal;
    const bValue = oppInternal;
    const total = aValue + bValue;
    if (total <= 0) {
      return null;
    }
    return {
      aDisplay: displayInfluence(aValue),
      bDisplay: displayInfluence(bValue),
      aRatio: aValue / total,
      aColor: 'own',
      bColor: 'rival',
    };
  }

  const aValue = leaderInternal;
  const bValue = challengerInternal;
  const total = aValue + bValue;
  if (total <= 0) {
    return null;
  }

  const ownerIsMe = userId != null && cell.ownerId === userId;
  return {
    aDisplay: displayInfluence(aValue),
    bDisplay: displayInfluence(bValue),
    aRatio: aValue / total,
    aColor: ownerIsMe ? 'own' : 'rival',
    bColor: ownerIsMe ? 'rival' : 'own',
  };
}

function fillForTone(tone: 'own' | 'rival'): string {
  return tone === 'own' ? MAP_OWN_FILL : MAP_RIVAL_FILL;
}

function strokeForTone(tone: 'own' | 'rival'): string {
  return tone === 'own' ? MAP_OWN_STROKE : MAP_RIVAL_STROKE;
}

export { fillForTone, strokeForTone };

export function buildCellVisual(
  cell: MapCell,
  currentUserId: string | undefined,
  rivalH3: Set<string>,
  targetH3: Set<string>,
  targetCategoryByH3: Map<string, CaptureTarget['category']>,
  previewFlash: boolean,
): CellVisual {
  const leaderInternal = leaderInfluenceInternal(cell);
  const fillOpacity = influenceOpacity(leaderInternal);
  const isMine = cell.ownerId === currentUserId;
  const isNeutral = !cell.ownerId;
  const freshness =
    isMine && (cell.myInfluence ?? 0) > 0 ? (cell.decayRisk ?? 'none') : 'none';
  const contested = Boolean(cell.contested);

  if (targetH3.has(cell.h3Index)) {
    const colors = targetColors(targetCategoryByH3.get(cell.h3Index) ?? 'capture');
    return {
      fill: colors.fill,
      stroke: colors.stroke,
      fillOpacity: Math.max(fillOpacity, 0.5),
      strokeColor: colors.stroke,
      strokeWeight: 2.5,
      contested: false,
      freshness: 'none',
    };
  }

  if (isNeutral) {
    return {
      fill: NEUTRAL_FILL,
      stroke: NEUTRAL_STROKE,
      fillOpacity: 0.32,
      strokeColor: NEUTRAL_STROKE,
      strokeWeight: 1.5,
      contested: false,
      freshness: 'none',
    };
  }

  const fill = isMine ? MAP_OWN_FILL : MAP_RIVAL_FILL;
  const baseStroke = isMine ? MAP_OWN_STROKE : MAP_RIVAL_STROKE;
  let strokeColor = baseStroke;
  let dashArray: string | undefined;
  let strokeWeight = 2.5;

  if (contested && getContestedSplit(cell, currentUserId)) {
    strokeColor = '#3D3D3D';
    strokeWeight = 2.5;
  } else if (freshness === 'critical') {
    strokeColor = CRIT_STROKE;
    dashArray = '4 4';
    strokeWeight = 2.5;
  } else if (freshness === 'warning') {
    strokeColor = WARN_STROKE;
    dashArray = '8 5';
    strokeWeight = 2.5;
  }

  if (previewFlash && isMine) {
    return {
      fill: MAP_OWN_FILL,
      stroke: MAP_OWN_STROKE,
      fillOpacity: Math.min(0.92, fillOpacity + 0.08),
      strokeColor: MAP_OWN_STROKE,
      strokeWeight: 3,
      contested,
      freshness,
      dashArray,
    };
  }

  if (rivalH3.has(cell.h3Index) && !isMine) {
    return {
      fill: MAP_RIVAL_FILL,
      stroke: MAP_RIVAL_STROKE,
      fillOpacity,
      strokeColor: MAP_RIVAL_STROKE,
      strokeWeight: 2.5,
      contested,
      freshness: 'none',
    };
  }

  return {
    fill,
    stroke: baseStroke,
    fillOpacity,
    strokeColor,
    strokeWeight,
    dashArray,
    contested,
    freshness,
  };
}

export function cellPolygonClassName(
  cell: MapCell,
  currentUserId: string | undefined,
  visual: CellVisual,
  targetH3: Set<string>,
  previewFlash: boolean,
): string {
  const classes = ['map-cell-polygon'];
  if (visual.contested && getContestedSplit(cell, currentUserId)) {
    classes.push('contested-cell');
  } else if (cell.ownerId === currentUserId) {
    classes.push('owned-cell');
    if (previewFlash) classes.push('cell-preview-flash');
  } else if (!cell.ownerId) {
    classes.push('neutral-cell');
  } else {
    classes.push('rival-cell');
  }
  if (visual.freshness === 'warning') classes.push('freshness-warning');
  if (visual.freshness === 'critical') classes.push('freshness-critical');
  if (targetH3.has(cell.h3Index)) classes.push('capture-target-cell');
  return classes.join(' ');
}

export function targetCellVisual(category: CaptureTarget['category']): CellVisual {
  const colors = targetColors(category);
  return {
    fill: colors.fill,
    stroke: colors.stroke,
    fillOpacity: 0.55,
    strokeColor: colors.stroke,
    strokeWeight: 2.5,
    contested: false,
    freshness: 'none',
  };
}

export function isStaleCell(cell: MapCell, userId: string | undefined): boolean {
  if (!userId || cell.ownerId !== userId) {
    return false;
  }
  return cell.decayRisk === 'warning' || cell.decayRisk === 'critical';
}
