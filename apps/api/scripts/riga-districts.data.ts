import { GeoJsonPolygon } from '../src/common/geo.util';

/** Test districts around Riga (approximate bounding boxes). Coordinates: [lng, lat]. */
export const RIGA_DISTRICTS: Array<{ name: string; polygon: GeoJsonPolygon }> = [
  {
    name: 'Vecrīga (Old Town)',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [24.102, 56.947],
          [24.112, 56.947],
          [24.112, 56.952],
          [24.102, 56.952],
          [24.102, 56.947],
        ],
      ],
    },
  },
  {
    name: 'Centrs',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [24.105, 56.952],
          [24.125, 56.952],
          [24.125, 56.962],
          [24.105, 56.962],
          [24.105, 56.952],
        ],
      ],
    },
  },
  {
    name: 'Agenskalns',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [24.075, 56.935],
          [24.102, 56.935],
          [24.102, 56.952],
          [24.075, 56.952],
          [24.075, 56.935],
        ],
      ],
    },
  },
  {
    name: 'Maskavas priekšpilsēta',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [24.112, 56.935],
          [24.135, 56.935],
          [24.135, 56.952],
          [24.112, 56.952],
          [24.112, 56.935],
        ],
      ],
    },
  },
  {
    name: 'Purvciems',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [24.125, 56.952],
          [24.155, 56.952],
          [24.155, 56.972],
          [24.125, 56.972],
          [24.125, 56.952],
        ],
      ],
    },
  },
];
