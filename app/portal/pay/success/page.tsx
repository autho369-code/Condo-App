import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PaySuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  await requireAuth();
  const { session_id } = await searchParams;
  const supabase = await createClient();

  // Stripe webhook updates our row when it fires checkout.session.completed.
  // If the user lands here before the webhook arrives, show "processing".
  const { data: pi } = session_id
    ? await (supabase as any).from('payment_intents').select('*').eq('stripe_checkout_session_id', session_id).maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Thank you — payment received</CardTitle>
        </CardHeader>
        <CardBody>
          {pi ? (
            <>
              <p className="text-sm text-slate-400">Your payment has been {pi.status === 'succeeded' ? 'confirmed and applied to your account' : 'received and is being processed'}.</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-slate-400">Amount</dt><dd className="font-medium">{money(pi.amount)}</dd>
                <dt className="text-slate-400">Status</dt>
                <dd><span className={`rounded px-2 py-0.5 text-xs ${
                  pi.status === 'succeeded'   ? 'bg-green-100 text-green-700'
                  : pi.status === 'processing'? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-700'
                }`}>{pi.status}</span></dd>
                <dt className="text-slate-400">Method</dt><dd className="uppercase">{pi.method}</dd>
                <dt className="text-slate-400">Paid at</dt><dd>{pi.paid_at ? date(pi.paid_at) : '—'}</dd>
                <dt className="text-slate-400">Confirmation #</dt>
                <dd className="font-mono text-xs">{pi.stripe_payment_intent_id ?? pi.stripe_checkout_session_id ?? pi.id}</dd>
              </dl>
              <p className="mt-4 text-xs text-slate-400">A receipt has been emailed to you.</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Your payment is being processed. Check your account balance in a few minutes.</p>
          )}

          <div className="mt-6 flex gap-2">
            <Link href="/portal"><Button>Back to portal</Button></Link>
            <Link href="/portal/ledger"><Button variant="secondary">View ledger</Button></Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
