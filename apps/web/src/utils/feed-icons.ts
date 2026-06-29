export function feedEventIcon(type: string): string {
  switch (type) {
    case 'activity_completed':
      return '🏃';
    case 'cell_captured':
      return '🟢';
    case 'cell_siege':
      return '⚔️';
    case 'district_captured':
      return '👑';
    default:
      return '•';
  }
}

export function feedEventColor(type: string): string {
  switch (type) {
    case 'cell_siege':
      return 'var(--cell-critical)';
    case 'cell_captured':
      return 'var(--cell-own)';
    case 'district_captured':
      return 'var(--cell-target)';
    default:
      return 'var(--text-muted)';
  }
}
