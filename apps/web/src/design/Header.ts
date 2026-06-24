/**
 * Territory Run — Design Tokens
 * Neon Territory v1 · Teal-green accent
 */

import type { CSSProperties } from 'react';

export const colors = {
  bg0: '#080d18',
  bg1: '#111827',
  bg2: '#1a2336',
  bg3: '#2a3045',
  textPrimary: '#eef2ff',
  textSecondary: '#8899bb',
  textMuted: '#3d4f6a',
  cyan: '#3ecfb8',
  cyanLo: 'rgba(62, 207, 184, 0.13)',
  cyanMid: 'rgba(62, 207, 184, 0.27)',
  cyanHover: '#62dcc7',
  cyanPressed: '#28b09c',
  green: '#3dff8a',
  orange: '#ff9f43',
  red: '#ff5a4a',
  pink: '#ff6b9d',
  yellow: '#f5c842',
  purple: '#9b6dff',
  greenLo: 'rgba(61, 255, 138, 0.13)',
  orangeLo: 'rgba(255, 159, 67, 0.13)',
  redLo: 'rgba(255, 90, 74, 0.13)',
  glassBg: 'rgba(17, 24, 54, 0.84)',
  glassBorder: 'rgba(62, 207, 184, 0.22)',
} as const;

export const fonts = {
  display: "'Rajdhani', 'Exo 2', sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

export const fontSize = {
  hero: 22,
  h1: 16,
  h2: 13,
  body: 12,
  label: 10,
  xs: 9,
  nav: 8,
} as const;

export const fontWeight = {
  regular: 400,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  full: 9999,
} as const;

export function createGlass(overrides: CSSProperties = {}): CSSProperties {
  return {
    background: colors.glassBg,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radius.lg,
    ...overrides,
  };
}

export const btnPrimary = {
  base: {
    background: colors.cyan,
    color: colors.bg0,
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    letterSpacing: '0.08em',
    borderRadius: radius.md,
    border: 'none',
    cursor: 'pointer',
  },
  hover: { background: colors.cyanHover },
  pressed: { background: colors.cyanPressed },
  disabled: { background: colors.bg3, opacity: 0.5 },
} as const;

export const btnSecondary = {
  base: {
    background: colors.bg1,
    color: colors.cyan,
    fontFamily: fonts.body,
    fontSize: fontSize.h2,
    fontWeight: fontWeight.semibold,
    borderRadius: radius.md,
    border: `1.5px solid ${colors.cyan}`,
    cursor: 'pointer',
  },
  hover: { background: colors.bg2 },
  pressed: { background: colors.cyanMid },
  disabled: { opacity: 0.45 },
} as const;

export const btnDanger = {
  base: {
    background: colors.red,
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    borderRadius: radius.md,
    border: 'none',
    cursor: 'pointer',
  },
  hover: { background: '#ff7a6e' },
  pressed: { background: '#c43020' },
} as const;

export const cellColor = {
  own: colors.cyan,
  decay: colors.orange,
  crit: colors.red,
  rival: colors.pink,
  target: colors.yellow,
  capture: colors.green,
  other: colors.purple,
  empty: colors.bg3,
} as const;

export type CellColorKey = keyof typeof cellColor;
