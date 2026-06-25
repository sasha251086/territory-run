import type { SignOptions } from 'jsonwebtoken';

type JwtExpiresIn = NonNullable<SignOptions['expiresIn']>;

/** Short-lived API token — keep long enough for idle gameplay without re-login. */
export const JWT_ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ??
  '7d') as JwtExpiresIn;

/** Refresh token lifetime stored in DB (days). */
export const JWT_REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '90');

export const JWT_REFRESH_EXPIRES_IN = `${JWT_REFRESH_EXPIRES_DAYS}d` as JwtExpiresIn;

export const JWT_REFRESH_EXPIRES_MS = JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
