export function getTokenExpiryMs(token: string | null | undefined): number | null {
  if (!token) {
    return null;
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when token is missing, unreadable, or within `skewMs` of expiry. */
export function isAccessTokenExpired(token: string | null | undefined, skewMs = 60_000): boolean {
  const expiry = getTokenExpiryMs(token);
  if (!expiry) {
    return true;
  }
  return Date.now() >= expiry - skewMs;
}
