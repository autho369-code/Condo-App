'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { consumeScopedRateLimit } from '@/lib/server/rate-limit';
import { createServiceClient } from '@/lib/supabase/server';
import { isUnsubscribeToken } from '@/lib/email/unsubscribe';
import { tokenMatchesAddress } from '@/lib/tenant/token-company';

// Public, token-authenticated: the token in the email is the only
// credential, checked by service-role-only functions; every call is rate
// limited.

// The page shows fixed wording for these codes (never text from the URL,
// which anyone could put in a link on the company's address).
function back(token: string, key: 'error' | 'done', code: 'rate' | 'failed' | 'unsubscribed' | 'resubscribed'): never {
  redirect(`/unsubscribe/${token}?${key}=${code}`);
}

export async function setUnsubscribed(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  if (!isUnsubscribeToken(token)) redirect('/unsubscribe/invalid');
  const unsubscribe = formData.get('choice') === 'unsubscribe';
  const svc = createServiceClient() as any;
  const h = await headers();
  // Per link (neighbours behind one office network each have their own), and
  // an unsubscribe isn't lost when the limiter is down.
  const limit = await consumeScopedRateLimit(svc, token, { scope: 'email_unsubscribe_action', windowSeconds: 600, maxRequests: 10 });
  if (!limit.allowed && !limit.unavailable) back(token, 'error', 'rate');

  const { data: session } = await svc.rpc('email_unsubscribe_session', { p_token: token });
  if (!session || !tokenMatchesAddress(h, session.portfolio_id)) redirect('/unsubscribe/invalid');

  const { data: done, error } = await svc.rpc('email_set_unsubscribed', {
    p_token: token,
    p_unsubscribed: unsubscribe,
    p_source: unsubscribe ? 'unsubscribe_page' : 'resubscribed_by_recipient',
  });
  if (error || !done) back(token, 'error', 'failed');
  back(token, 'done', unsubscribe ? 'unsubscribed' : 'resubscribed');
}
