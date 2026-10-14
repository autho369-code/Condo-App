import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { buttonClass } from '@/components/ui/button';
import { money } from '@/lib/utils'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Alert } from '@/components/ui/shell'
import { paymentNotCompleted } from '@/lib/portal/payment-outcome'

export const dynamic = 'force-dynamic'

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>
}) {
  const sp = await searchParams
  await requireOwner()
  const supabase = await createClient()

  // RLS: the owner can only read their own intents.
  const { data: intent, error: intentError } = sp.intent
    ? await (supabase as any).from('payment_intents').select('amount, status, method, created_at').eq('id', sp.intent).maybeSingle()
    : { data: null, error: null }

  const settled = intent?.status === 'succeeded'
  // A failed, canceled, returned, refunded or disputed payment must never
  // read as "submitted".
  const notCompleted = paymentNotCompleted(intent?.status)

  if (notCompleted) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
        <XCircle className="mx-auto h-14 w-14 text-red-500" />
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">
            {notCompleted.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {notCompleted.body(money(Number(intent.amount)))}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Link href="/portal/ledger" className={buttonClass('secondary')}>View ledger</Link>
          <Link href="/portal/pay" className={buttonClass()}>Back to Pay</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
      {settled ? (
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
      ) : (
        <Clock className="mx-auto h-14 w-14 text-blue-500" />
      )}
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">
          {settled ? 'Payment received' : 'Payment submitted'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {intent
            ? settled
              ? `Your ${money(Number(intent.amount))} payment has been applied to your account.`
              : `Your ${money(Number(intent.amount))} payment was submitted. Bank (ACH) payments take 3–5 business days to clear — your ledger updates automatically when it settles.`
            : 'Your payment was submitted. It will appear on your ledger once confirmed.'}
        </p>
      </div>
      {intentError && (
        <Alert tone="warning" title="Could not check your payment:">{intentError.message}. Check your ledger to confirm it went through.</Alert>
      )}
      <div className="flex justify-center gap-2">
        <Link href="/portal/ledger" className={buttonClass('secondary')}>View ledger</Link>
        <Link href="/portal" className={buttonClass()}>Back to dashboard</Link>
      </div>
    </div>
  )
}
