import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { injectMapHatchPatterns } from '../utils/map-hatch';

const MAP_PANES = ['overlayPane', 'highlightPane', 'activityFocusPane'] as const;

export default function MapHatchPatternDefs() {
  const map = useMap();

  useEffect(() => {
    const sync = () => {
      for (const paneName of MAP_PANES) {
        const pane = map.getPane(paneName);
        const svg = pane?.querySelector('svg');
        if (svg) {
          injectMapHatchPatterns(svg);
        }
      }
    };

    sync();
    map.on('layeradd', sync);
    return () => {
      map.off('layeradd', sync);
    };
  }, [map]);

  return null;
}
