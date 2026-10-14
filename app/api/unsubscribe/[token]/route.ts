import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { consumeScopedRateLimit } from '@/lib/server/rate-limit';
import { isUnsubscribeToken } from '@/lib/email/unsubscribe';
import { tokenMatchesAddress } from '@/lib/tenant/token-company';

export const dynamic = 'force-dynamic';

// One-click unsubscribe (RFC 8058): the mail provider POSTs
// "List-Unsubscribe=One-Click" here when the recipient presses its
// Unsubscribe button. No sign-in: the token is the credential.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isUnsubscribeToken(token)) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  const svc = createServiceClient() as any;
  // Mail providers send every recipient's one-click from shared servers, so
  // the limit is per link (not per address), and an unsubscribe goes through
  // when the limiter is down: losing one is worse than an extra request (the
  // 256-bit token can't be guessed).
  const limit = await consumeScopedRateLimit(svc, token, { scope: 'email_unsubscribe_post', windowSeconds: 600, maxRequests: 10 });
  if (!limit.allowed && !limit.unavailable) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { data: session, error: sessionError } = await svc.rpc('email_unsubscribe_session', { p_token: token });
  if (sessionError) return NextResponse.json({ error: 'Could not unsubscribe' }, { status: 500 });
  // A link from another company is not valid on this company's address.
  if (!session || !tokenMatchesAddress(request.headers, session.portfolio_id)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  }
  const { error } = await svc.rpc('email_set_unsubscribed', { p_token: token, p_unsubscribed: true, p_source: 'one_click' });
  if (error) return NextResponse.json({ error: 'Could not unsubscribe' }, { status: 500 });
  return new NextResponse(null, { status: 200 });
}

// Opened in a browser: the page, which asks before changing anything (link
// scanners open links, so a visit alone never unsubscribes).
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = new URL(isUnsubscribeToken(token) ? `/unsubscribe/${token}` : '/unsubscribe/invalid', request.nextUrl.origin);
  return NextResponse.redirect(target, 303);
}
