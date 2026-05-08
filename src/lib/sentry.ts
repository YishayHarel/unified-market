import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry(): void {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
  initialized = true;
}

export function captureException(
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  if (!initialized) return;
  Sentry.captureException(error, extras ? { extra: extras } : undefined);
}
