import * as Sentry from '@sentry/node';

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
  });
}

export function captureException(
  exception: unknown,
  context?: Record<string, unknown>,
): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }
    if (exception instanceof Error) {
      Sentry.captureException(exception);
    } else {
      Sentry.captureMessage(String(exception));
    }
  });
}
