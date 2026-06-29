export type HatchKind = 'siege' | 'capture' | 'warning' | 'expand' | 'selected' | 'territory' | 'run';

export const HATCH_PATTERN_IDS: Record<HatchKind, string> = {
  siege: 'tr-hatch-siege',
  capture: 'tr-hatch-capture',
  warning: 'tr-hatch-warning',
  expand: 'tr-hatch-expand',
  selected: 'tr-hatch-selected',
  territory: 'tr-hatch-territory',
  run: 'tr-hatch-run',
};

type PatternSpec = {
  id: string;
  base: string;
  line: string;
  lineWidth: number;
  spacing: number;
  angle?: number;
};

const PATTERN_SPECS: PatternSpec[] = [
  {
    id: HATCH_PATTERN_IDS.siege,
    base: 'rgba(255, 228, 228, 0.82)',
    line: '#7f1d1d',
    lineWidth: 4.5,
    spacing: 9,
    angle: 45,
  },
  {
    id: HATCH_PATTERN_IDS.capture,
    base: 'rgba(255, 244, 196, 0.85)',
    line: '#92400e',
    lineWidth: 4,
    spacing: 9,
    angle: -45,
  },
  {
    id: HATCH_PATTERN_IDS.warning,
    base: 'rgba(255, 237, 213, 0.85)',
    line: '#c2410c',
    lineWidth: 4,
    spacing: 9,
    angle: 45,
  },
  {
    id: HATCH_PATTERN_IDS.expand,
    base: 'rgba(220, 252, 231, 0.85)',
    line: '#15803d',
    lineWidth: 4,
    spacing: 9,
    angle: -45,
  },
  {
    id: HATCH_PATTERN_IDS.selected,
    base: 'rgba(255, 255, 255, 0.72)',
    line: '#111111',
    lineWidth: 4,
    spacing: 8,
    angle: 45,
  },
  {
    id: HATCH_PATTERN_IDS.territory,
    base: 'rgba(220, 252, 231, 0.72)',
    line: '#166534',
    lineWidth: 3.5,
    spacing: 10,
    angle: -45,
  },
  {
    id: HATCH_PATTERN_IDS.run,
    base: 'rgba(219, 234, 254, 0.82)',
    line: '#1d4ed8',
    lineWidth: 4,
    spacing: 9,
    angle: 45,
  },
];

function buildPatternElement(spec: PatternSpec): SVGPatternElement {
  const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
  pattern.setAttribute('id', spec.id);
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('width', String(spec.spacing));
  pattern.setAttribute('height', String(spec.spacing));
  if (spec.angle) {
    pattern.setAttribute('patternTransform', `rotate(${spec.angle})`);
  }

  const base = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  base.setAttribute('width', String(spec.spacing));
  base.setAttribute('height', String(spec.spacing));
  base.setAttribute('fill', spec.base);
  pattern.appendChild(base);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', '0');
  line.setAttribute('y1', '0');
  line.setAttribute('x2', '0');
  line.setAttribute('y2', String(spec.spacing));
  line.setAttribute('stroke', spec.line);
  line.setAttribute('stroke-width', String(spec.lineWidth));
  line.setAttribute('stroke-linecap', 'square');
  pattern.appendChild(line);

  return pattern;
}

export function injectMapHatchPatterns(root: ParentNode): void {
  let defs = root.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    root.insertBefore(defs, root.firstChild);
  }

  for (const spec of PATTERN_SPECS) {
    if (defs.querySelector(`#${spec.id}`)) {
      continue;
    }
    defs.appendChild(buildPatternElement(spec));
  }
}

export function hatchFill(kind: HatchKind): string {
  return `url(#${HATCH_PATTERN_IDS[kind]})`;
}

export function targetCategoryToHatch(
  category: 'defend' | 'finish' | 'capture' | 'expand',
): HatchKind {
  if (category === 'defend') return 'siege';
  if (category === 'finish') return 'warning';
  if (category === 'expand') return 'expand';
  return 'capture';
}
