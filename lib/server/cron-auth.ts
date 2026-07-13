import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Fail-closed guard for scheduled/background endpoints.
 *
 * Cron routes often need to be public at middleware level so hosted schedulers
 * can reach them without a browser session. This helper is the actual gate:
 * the job never runs unless CRON_SECRET is configured and the request presents
 * the exact bearer token. Vercel sends `Authorization: Bearer ${CRON_SECRET}`
 * automatically once the env var exists.
 */
export function requireCronSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'Cron secret is not configured' }, { status: 503 });
  }

  const presented = request.headers.get('authorization') ?? '';
  // Hash both sides so timingSafeEqual gets equal-length buffers regardless
  // of what the caller sent (it throws on length mismatch otherwise).
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(`Bearer ${secret}`).digest();
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
