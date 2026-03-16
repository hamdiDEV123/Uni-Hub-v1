import * as Sentry from "@sentry/react";

export const initSentry = () => {
  // only initialise in production (Vite exposes `import.meta.env.PROD`)
  if (import.meta.env.PROD) {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) {
      // guard against forgetting to set the DSN; do nothing if it's missing
      console.warn("Sentry DSN missing, skipping init");
      return;
    }

    Sentry.init({
      dsn,
      integrations: [
        Sentry.browserTracingIntegration(),
        // NOTE: replay requires separate package (@sentry/replay). install
        // when you're ready to record session replays, or uncomment after
        // adding the dependency.
        // (new Replay() as any),
      ],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }
};
