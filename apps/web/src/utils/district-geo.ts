import type { LatLngExpression } from 'leaflet';
import type { DistrictListItem } from '../api/types';

/** One or more Leaflet polygon ringsets (outer + optional holes). */
export function districtPolygonsForMap(
  polygon: DistrictListItem['polygon'],
): LatLngExpression[][][] {
  if (polygon.type === 'Polygon') {
    const rings = polygon.coordinates as number[][][];
    return [
      rings.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as LatLngExpression),
      ),
    ];
  }

  if (polygon.type === 'MultiPolygon') {
    const polygons = polygon.coordinates as number[][][][];
    return polygons.map((poly) =>
      poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as LatLngExpression)),
    );
  }

  return [];
}

export function districtHudClass(controlPercent: number, isKing: boolean): string {
  if (isKing || controlPercent >= 40) {
    return 'map-district-hud__item--king';
  }
  if (controlPercent >= 30) {
    return 'map-district-hud__item--close';
  }
  return '';
}
