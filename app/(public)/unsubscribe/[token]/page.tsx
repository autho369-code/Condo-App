import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Alert, Surface } from '@/components/ui/shell';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { consumePublicRateLimit } from '@/lib/server/rate-limit';
import { createServiceClient } from '@/lib/supabase/server';
import { isUnsubscribeToken } from '@/lib/email/unsubscribe';
import { companyAddressOf, companyAddressRedirect, noticeQuery, tokenMatchesAddress } from '@/lib/tenant/token-company';
import { setUnsubscribed } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Email preferences', robots: { index: false, follow: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">{children}</div>;
}
const heading = 'break-words font-display text-[24px] font-bold leading-[1.15] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[28px]';

/**
 * The page an optional email's Unsubscribe link opens. Opening it changes
 * nothing (mail scanners open links); the recipient presses the button.
 */
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const invalid = (
    <Shell>
      <Surface className="text-center">
        <h1 className={heading}>This link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-gray-500">Use the Unsubscribe link in a recent email, or contact your management company.</p>
      </Surface>
    </Shell>
  );
  if (!isUnsubscribeToken(token)) return invalid;

  const svc = createServiceClient() as any;
  const h = await headers();
  const limit = await consumePublicRateLimit(svc, h, { scope: 'email_unsubscribe_view', windowSeconds: 600, maxRequests: 60 });
  if (!limit.allowed) return <Shell><Alert tone="warning">Too many requests. Please wait a few minutes and reload.</Alert></Shell>;

  const { data: s } = await svc.rpc('email_unsubscribe_session', { p_token: token });
  if (!s || !tokenMatchesAddress(h, s.portfolio_id)) return invalid;
  const move = companyAddressRedirect(h, await companyAddressOf(svc, s.portfolio_id), `/unsubscribe/${token}${noticeQuery(sp)}`);
  if (move) redirect(move);

  // Fixed wording by code: text in the URL is never shown.
  const done = sp.done === 'unsubscribed' ? `You're unsubscribed from optional email from ${s.company_name}.`
    : sp.done === 'resubscribed' ? `You'll get optional email from ${s.company_name} again.`
    : null;
  const error = sp.error === 'rate' ? 'Too many attempts. Please wait a few minutes and try again.'
    : sp.error ? 'That didn\'t work. Please try again.'
    : null;

  return (
    <Shell>
      <div className="space-y-5">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.company_name}</div>
          <h1 className={`mt-1 ${heading}`}>Email preferences</h1>
          <p className="mt-1 text-sm text-gray-500">For {s.email_hint}</p>
        </div>

        {done && <Alert tone="success"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />{done}</span></Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <Surface>
          <form action={setUnsubscribed} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            {s.unsubscribed ? (
              <>
                <p className="text-sm text-gray-700">
                  You&apos;re unsubscribed from optional email from {s.company_name}, such as announcements and reminders.
                </p>
                <input type="hidden" name="choice" value="resubscribe" />
                <PendingSubmit variant="secondary" pendingLabel="Saving…">Get optional email again</PendingSubmit>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700">
                  Stop optional email from {s.company_name}, such as announcements, newsletters and reminders.
                </p>
                <input type="hidden" name="choice" value="unsubscribe" />
                <PendingSubmit pendingLabel="Unsubscribing…">Unsubscribe</PendingSubmit>
              </>
            )}
            <p className="text-[13px] text-gray-500">
              Notices about your account and property, such as statements, receipts, violation and meeting notices, are still sent.
            </p>
          </form>
        </Surface>
      </div>
    </Shell>
  );
}
