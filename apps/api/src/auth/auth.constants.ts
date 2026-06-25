const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const DEFAULT_ACCESS_EXPIRES_SECONDS = 7 * DAY;

function parseExpiresInSeconds(value: string | undefined): number {
  if (!value?.trim()) {
    return DEFAULT_ACCESS_EXPIRES_SECONDS;
  }

  const match = /^(\d+)([smhdw])$/i.exec(value.trim());
  if (!match) {
    return DEFAULT_ACCESS_EXPIRES_SECONDS;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: SECOND,
    m: MINUTE,
    h: HOUR,
    d: DAY,
    w: WEEK,
  };

  return amount * multipliers[unit];
}

/** Access token lifetime in seconds (env: JWT_ACCESS_EXPIRES_IN, e.g. 7d, 24h). */
export const JWT_ACCESS_EXPIRES_SECONDS = parseExpiresInSeconds(
  process.env.JWT_ACCESS_EXPIRES_IN,
);

/** Refresh token lifetime stored in DB (days). */
export const JWT_REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '90');

export const JWT_REFRESH_EXPIRES_SECONDS = JWT_REFRESH_EXPIRES_DAYS * DAY;

export const JWT_REFRESH_EXPIRES_MS = JWT_REFRESH_EXPIRES_SECONDS * 1000;
