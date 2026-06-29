import { Marker } from 'react-leaflet';
import { cellToLatLng } from 'h3-js';
import L from 'leaflet';
import type { MapCell } from '../api/types';
import { mapCellInfluenceLabel } from '../constants/game';
import { getContestedSplit } from '../utils/map-cell-visual';

const MIN_LABEL_ZOOM = 14;

function cellCenter(cell: MapCell): [number, number] | null {
  if (cell.lat != null && cell.lng != null) {
    return [cell.lat, cell.lng];
  }
  try {
    const [lat, lng] = cellToLatLng(cell.h3Index);
    return [lat, lng];
  } catch {
    return null;
  }
}

function labelSizeClass(...values: number[]): string {
  return values.some((value) => value >= 1000) ? ' cell-label--compact' : '';
}

function labelHtml(cell: MapCell, userId: string | undefined): string | null {
  if (!userId) return null;

  const contested = getContestedSplit(cell, userId);
  if (contested) {
    const aClass = contested.aColor === 'own' ? 'cell-label-mine' : 'cell-label-rival';
    const bClass = contested.bColor === 'own' ? 'cell-label-mine' : 'cell-label-rival';
    const compact = labelSizeClass(contested.aDisplay, contested.bDisplay);
    return `<div class="cell-label cell-label--contested${compact}"><span class="${aClass}">${contested.aDisplay}</span><span class="cell-label-sep">·</span><span class="${bClass}">${contested.bDisplay}</span></div>`;
  }

  let value: number | null = null;
  let tone: 'mine' | 'rival' | 'neutral' = 'neutral';

  if (cell.myInfluence != null && cell.myInfluence > 0) {
    value = mapCellInfluenceLabel(cell.myInfluence);
    tone = 'mine';
  } else if (cell.ownerId === userId && cell.influence > 0) {
    value = mapCellInfluenceLabel(cell.influence);
    tone = 'mine';
  } else if (cell.influence > 0 && cell.ownerId) {
    value = mapCellInfluenceLabel(cell.influence);
    tone = cell.ownerId === userId ? 'mine' : 'rival';
  }

  if (value == null || value <= 0) {
    return null;
  }

  const compact = labelSizeClass(value);
  return `<div class="cell-label cell-label--${tone}${compact}"><span>${value}</span></div>`;
}

export default function CellInfluenceLabels({
  cells,
  zoom,
  userId,
}: {
  cells: MapCell[];
  zoom: number;
  userId: string | undefined;
}) {
  if (zoom < MIN_LABEL_ZOOM) {
    return null;
  }

  return (
    <>
      {cells.map((cell) => {
        const center = cellCenter(cell);
        const html = labelHtml(cell, userId);
        if (!center || !html) {
          return null;
        }

        return (
          <Marker
            key={`label-${cell.h3Index}`}
            position={center}
            pane="labelPane"
            interactive={false}
            zIndexOffset={400}
            icon={L.divIcon({
              className: 'cell-influence-marker',
              html,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            })}
          />
        );
      })}
    </>
  );
}
