/** Paper Atlas design tokens — applied on <html> so WebView always picks them up. */
export const PAPER_ATLAS_CSS_VARS: Record<string, string> = {
  '--bg': '#f7f4ee',
  '--surface': '#ffffff',
  '--surface-2': '#f0ebe3',
  '--border': '#e5ddd2',
  '--border-strong': '#2c2825',
  '--text': '#2c2825',
  '--text-secondary': '#5c564e',
  '--text-muted': '#8a8378',
  '--btn-primary': '#5b8a72',
  '--cell-own': '#5b8a72',
  '--cell-own-stroke': '#466b58',
  '--cell-rival': '#6b7fa3',
  '--cell-rival-stroke': '#556a8a',
  '--cell-empty': 'rgba(91, 138, 114, 0.08)',
  '--cell-empty-stroke': '#d4c9ba',
  '--cell-risk': '#c4a35a',
  '--cell-risk-stroke': '#a88640',
  '--cell-critical': '#b85c5c',
  '--cell-critical-stroke': '#9a4848',
  '--cell-target': '#c4a35a',
  '--cell-target-stroke': '#a88640',
  '--cell-other': '#6b7fa3',
  '--cell-other-stroke': '#556a8a',
  '--radius': '12px',
  '--radius-sm': '8px',
  '--shadow-card': '0 4px 20px rgba(44, 40, 37, 0.06)',
  '--shadow-celebration': '0 12px 40px rgba(44, 40, 37, 0.12)',
  '--font-display': "'Fraunces', Georgia, serif",
  '--font-body': "'DM Sans', system-ui, sans-serif",
  '--font-data': "'JetBrains Mono', monospace",
};

export function applyPaperAtlasTheme() {
  const root = document.documentElement;
  root.classList.add('paper-atlas');
  for (const [name, value] of Object.entries(PAPER_ATLAS_CSS_VARS)) {
    root.style.setProperty(name, value);
  }
}
