import { Pool, PoolConfig } from 'pg';

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === 'postgres';
}

function parseDatabaseHost(connectionString: string): string | null {
  try {
    const normalized = connectionString.replace(/^postgresql:\/\//, 'postgres://');
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

/** Remote Postgres (e.g. Render external URL) requires SSL; internal/local hosts do not. */
function needsSsl(connectionString: string): boolean {
  const host = parseDatabaseHost(connectionString);
  if (!host || isLocalHost(host)) {
    return false;
  }
  return host.includes('.');
}

export function createPgPool(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const config: PoolConfig = { connectionString };
  if (needsSsl(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  }

  return new Pool(config);
}
