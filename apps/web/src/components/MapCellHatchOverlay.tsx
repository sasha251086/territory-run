import { Polygon } from 'react-leaflet';
import { hatchFill, type HatchKind } from '../utils/map-hatch';

type Props = {
  h3Index: string;
  boundary: [number, number][];
  kind: HatchKind;
  pane?: string;
};

export default function MapCellHatchOverlay({
  h3Index,
  boundary,
  kind,
  pane = 'highlightPane',
}: Props) {
  return (
    <Polygon
      key={`hatch-${kind}-${h3Index}`}
      positions={boundary}
      pane={pane}
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
