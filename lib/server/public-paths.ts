/**
 * Routes that must remain reachable without a Supabase browser session.
 *
 * Cron endpoints still authenticate inside their route handlers with
 * `requireCronSecret`; listing them here only prevents middleware from
 * redirecting Vercel's cookie-less cron requests to `/login`.
 */
export const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/accept-invitation',
  '/api/auth/callback',
  '/report-violation',
  '/invite',
  '/demo',
  '/legal',
  '/api/demo-request',
  '/api/ai/analyze-violation-photo',
  '/api/piper',
  '/api/maintenance/send-reminders',
  '/api/insurance/send-reminders',
  '/api/payments/reconcile',
  '/api/payments/autopay-run',
  '/api/stripe/webhook',
  '/api/reports/run-scheduled',
  '/api/billing/assess-late-fees',
  '/api/automation/run-flows',
  '/api/email/process-queue',
  '/report-card',
] as const;
