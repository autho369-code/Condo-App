import { NextRequest, NextResponse } from 'next/server';

/**
 * Fail-closed guard for scheduled/background endpoints.
 *
 * Cron routes often need to be public at middleware level so hosted schedulers
 * can reach them without a browser session. This helper is the actual gate:
 * the job never runs unless CRON_SECRET is configured and the request presents
 * the exact bearer token.
 */
export function requireCronSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'Cron secret is not configured' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
