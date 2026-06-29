import { Polygon } from 'react-leaflet';
import L from 'leaflet';
import type { MapCell, CaptureTarget } from '../api/types';
import {
  buildCellVisual,
  cellPolygonClassName,
  getContestedSplit,
  fillForTone,
  strokeForTone,
} from '../utils/map-cell-visual';
import { splitHexDiagonal } from '../utils/hex-split';
import { hatchFill, targetCategoryToHatch, type HatchKind } from '../utils/map-hatch';

type Props = {
  cell: MapCell;
  boundary: [number, number][];
  userId: string | undefined;
  rivalH3: Set<string>;
  targetH3: Set<string>;
  targetCategoryByH3: Map<string, CaptureTarget['category']>;
  previewFlash: boolean;
  isSelected: boolean;
  emphasizeMine: boolean;
  emphasizeTarget: boolean;
  emphasizeSiege?: boolean;
  emphasizeRun?: boolean;
  onSelect: (cell: MapCell) => void;
};

function resolveHatchKind(opts: {
  isSelected: boolean;
  emphasizeSiege: boolean;
  emphasizeTarget: boolean;
  emphasizeMine: boolean;
  emphasizeRun: boolean;
  targetCategory?: CaptureTarget['category'];
}): HatchKind | null {
  if (opts.isSelected) return 'selected';
  if (opts.emphasizeSiege) return 'siege';
  if (opts.emphasizeTarget) {
    return targetCategoryToHatch(opts.targetCategory ?? 'capture');
  }
  if (opts.emphasizeRun) return 'run';
  if (opts.emphasizeMine) return 'territory';
  return null;
}

function CellHatchLayer({
  boundary,
  h3Index,
  kind,
}: {
  boundary: [number, number][];
  h3Index: string;
  kind: HatchKind;
}) {
  return (
    <Polygon
      key={`${h3Index}-hatch-${kind}`}
      positions={boundary}
      pathOptions={{
        stroke: false,
        weight: 0,
        fillColor: hatchFill(kind),
        fillOpacity: 1,
        fillRule: 'evenodd',
        interactive: false,
        className: `map-cell-hatch map-cell-hatch--${kind}`,
      }}
    />
  );
}

export default function MapCellPolygons({
  cell,
  boundary,
  userId,
  rivalH3,
  targetH3,
  targetCategoryByH3,
  previewFlash,
  isSelected,
  emphasizeMine,
  emphasizeTarget,
  emphasizeSiege = false,
  emphasizeRun = false,
  onSelect,
}: Props) {
  const visual = buildCellVisual(
    cell,
    userId,
    rivalH3,
    targetH3,
    targetCategoryByH3,
    previewFlash,
  );
  const targetCategory = targetCategoryByH3.get(cell.h3Index);
  const hatchKind = resolveHatchKind({
    isSelected,
    emphasizeSiege,
    emphasizeTarget,
    emphasizeMine,
    emphasizeRun,
    targetCategory,
  });
  const clickHandler = {
    click: (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event.originalEvent);
      onSelect(cell);
    },
  };

  const contestedSplit = getContestedSplit(cell, userId);
  if (contestedSplit) {
    const { aRatio, aColor, bColor } = contestedSplit;
    const { halfA, halfB } = splitHexDiagonal(boundary);
    const fillOpacity = visual.fillOpacity;

    const aLeads = aRatio >= 0.5;
    const firstHalf = aLeads ? halfA : halfB;
    const secondHalf = aLeads ? halfB : halfA;
    const firstColor = aColor;
    const secondColor = bColor;
    const outlineColor = visual.dashArray ? visual.strokeColor : strokeForTone(firstColor);

    return (
      <>
        <Polygon
          key={`${cell.h3Index}-a`}
          positions={firstHalf}
          pathOptions={{
            stroke: false,
            fillColor: fillForTone(firstColor),
            fillOpacity,
            className: ['contested-cell', 'map-cell-split', isSelected ? 'map-cell-selected' : '']
              .filter(Boolean)
              .join(' '),
          }}
          eventHandlers={clickHandler}
        />
        <Polygon
          key={`${cell.h3Index}-b`}
          positions={secondHalf}
          pathOptions={{
            stroke: false,
            fillColor: fillForTone(secondColor),
            fillOpacity,
            className: ['contested-cell', 'map-cell-split', isSelected ? 'map-cell-selected' : '']
              .filter(Boolean)
              .join(' '),
          }}
          eventHandlers={clickHandler}
        />
        <Polygon
          key={`${cell.h3Index}-outline`}
          positions={boundary}
          pathOptions={{
            stroke: true,
            color: outlineColor,
            fillOpacity: 0,
            fillColor: 'transparent',
            weight: 2,
            dashArray: visual.dashArray,
            lineJoin: 'round',
            className: 'map-cell-split-outline',
          }}
          eventHandlers={clickHandler}
        />
        {hatchKind && <CellHatchLayer boundary={boundary} h3Index={cell.h3Index} kind={hatchKind} />}
      </>
    );
  }

  return (
    <>
      <Polygon
        key={cell.h3Index}
        positions={boundary}
        pathOptions={{
          color: visual.strokeColor,
          fillColor: visual.fill,
          fillOpacity: visual.fillOpacity,
          opacity: 1,
          weight: visual.strokeWeight,
          dashArray: visual.dashArray,
          lineJoin: 'round',
          className: cellPolygonClassName(cell, userId, visual, targetH3, previewFlash),
        }}
        eventHandlers={clickHandler}
      />
      {hatchKind && <CellHatchLayer boundary={boundary} h3Index={cell.h3Index} kind={hatchKind} />}
    </>
  );
}
