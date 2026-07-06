import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Button } from '@/components/ui/button'
import { money } from '@/lib/utils'
import { CheckCircle2, Clock } from 'lucide-react'

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
  const { data: intent } = sp.intent
    ? await (supabase as any).from('payment_intents').select('amount, status, method, created_at').eq('id', sp.intent).maybeSingle()
    : { data: null }

  const settled = intent?.status === 'succeeded'

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
      {settled ? (
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
      ) : (
        <Clock className="mx-auto h-14 w-14 text-blue-500" />
      )}
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">
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
      <div className="flex justify-center gap-2">
        <Link href="/portal/ledger"><Button variant="secondary">View ledger</Button></Link>
        <Link href="/portal"><Button>Back to dashboard</Button></Link>
      </div>
    </div>
  )
}
