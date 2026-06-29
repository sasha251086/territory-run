const PREFIX = 'tr_hint_seen_';

export function hasSeenHint(key: string): boolean {
  try {
    return localStorage.getItem(`${PREFIX}${key}`) === '1';
  } catch {
    return false;
  }
}

export function markHintSeen(key: string): void {
  try {
    localStorage.setItem(`${PREFIX}${key}`, '1');
  } catch {
    // ignore storage errors
  }
}
