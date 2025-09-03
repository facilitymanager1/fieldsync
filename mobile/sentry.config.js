import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN || 'YOUR_SENTRY_DSN',
  enableAutoSessionTracking: true,
  debug: false,
});
