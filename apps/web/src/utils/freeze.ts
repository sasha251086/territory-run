export const FREEZE_DURATION_DAYS = 7;
export const FREEZE_COOLDOWN_DAYS = 90;

export function daysUntilFreezeEnds(activatedAt: string): number {
  const end = new Date(activatedAt);
  end.setDate(end.getDate() + FREEZE_DURATION_DAYS);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

export function daysUntilFreezeAvailable(lastUsedAt: string): number {
  const available = new Date(lastUsedAt);
  available.setDate(available.getDate() + FREEZE_COOLDOWN_DAYS);
  return Math.max(0, Math.ceil((available.getTime() - Date.now()) / 86_400_000));
}

export function canActivateFreeze(
  freezeActive: boolean,
  freezeLastUsedAt: string | null | undefined,
): boolean {
  if (freezeActive) return false;
  if (!freezeLastUsedAt) return true;
  return daysUntilFreezeAvailable(freezeLastUsedAt) === 0;
}
