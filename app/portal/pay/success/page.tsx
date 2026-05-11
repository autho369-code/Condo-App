import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardSubtitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/operations/status-chip';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  succeeded: 'success' as const,
  processing: 'warning' as const,
  failed: 'danger' as const,
  canceled: 'neutral' as const,
};

const STATUS_HEADLINE: Record<string, { eye: string; line: React.ReactNode }> = {
  succeeded: {
    eye: 'Payment confirmed',
    line: <>Thank you — <span className="italic text-champagne-700">it’s all settled.</span></>,
  },
  processing: {
    eye: 'Payment processing',
    line: <>We’ve received it. <span className="italic text-champagne-700">Posting shortly.</span></>,
  },
  failed: {
    eye: 'Payment did not go through',
    line: <>Something went sideways. <span className="italic text-bordeaux-700">Please try again.</span></>,
  },
};

export default async function PaySuccess({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  await requireAuth();
  const { session_id } = await searchParams;
  const supabase = await createClient();

  const { data: pi } = session_id
    ? await (supabase as any)
        .from('payment_intents')
        .select('*')
        .eq('stripe_checkout_session_id', session_id)
        .maybeSingle()
    : { data: null };

  const status = (pi?.status as keyof typeof STATUS_TONE) ?? 'processing';
  const headline = STATUS_HEADLINE[status] ?? STATUS_HEADLINE.processing;

  return (
    <div className="space-y-9">
      {/* Header */}
      <header className="border-b border-ink-100 pb-7">
        <div className="eyebrow">{headline.eye}</div>
        <h1 className="mt-2 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
          {headline.line}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-500">
          {pi
            ? status === 'succeeded'
              ? 'Your payment has been confirmed and applied to your account. A receipt has been emailed to you.'
              : status === 'processing'
              ? "Stripe will confirm the transaction within a few minutes. We'll apply it to your balance the moment it clears."
              : 'Your card was declined or the bank refused the transfer. No funds left your account. You can try a different payment method.'
            : "Your payment is being processed. Refresh this page in a few minutes to see it confirmed, or check your account balance."}
        </p>
      </header>

      {/* Receipt */}
      {pi && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Receipt</CardTitle>
              <StatusChip tone={STATUS_TONE[status] ?? 'neutral'}>{pi.status}</StatusChip>
            </div>
            <CardSubtitle>Keep this confirmation for your records.</CardSubtitle>
          </CardHeader>
          <CardBody className="px-0 py-0">
            <dl className="divide-y divide-ink-100">
              <ReceiptRow label="Amount paid" value={
                <span className="font-display text-lg tracking-editorial text-ink-900 number-plate">
                  {money(pi.amount)}
                </span>
              } />
              <ReceiptRow label="Method" value={
                <span className="uppercase text-[12px] tracking-[0.08em] font-medium text-ink-700">
                  {pi.method ?? '—'}
                </span>
              } />
              <ReceiptRow label="Posted" value={pi.paid_at ? date(pi.paid_at, 'long') : '—'} />
              <ReceiptRow label="Confirmation" value={
                <span className="font-mono text-[12px] text-ink-700 break-all">
                  {pi.stripe_payment_intent_id ?? pi.stripe_checkout_session_id ?? pi.id}
                </span>
              } />
            </dl>
          </CardBody>
        </Card>
      )}

      {/* CTA */}
      <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-6">
        <Link href="/portal">
          <Button size="md" variant="primary">Back to portal</Button>
        </Link>
        <Link href="/portal/ledger">
          <Button size="md" variant="outline">View ledger</Button>
        </Link>
        <Link href="/portal/statement">
          <Button size="md" variant="outline">Printable statement</Button>
        </Link>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-6 py-4">
      <dt className="eyebrow">{label}</dt>
      <dd className="text-right text-ink-900">{value}</dd>
    </div>
  );
}
