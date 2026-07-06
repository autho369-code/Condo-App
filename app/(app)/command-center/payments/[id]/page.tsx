import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { money } from '@/lib/utils'
import { ArrowLeft, CheckCircle2, Circle, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

const STEP_LABELS: Record<string, string> = {
  initiated: 'Owner clicked Pay',
  checkout_created: 'Secure checkout opened',
  stripe_accepted: 'Stripe accepted the payment',
  ledger_posted: 'Ledger updated',
  receipt_emailed: 'Receipt emailed',
  settlement_pending: 'Settlement pending',
  payout_created: 'Stripe payout created',
  bank_deposit_detected: 'Bank deposit detected',
  reconciled: 'Reconciled',
  failed: 'Payment failed',
  returned: 'Payment returned',
  refunded: 'Refunded',
  chargeback: 'Chargeback opened',
}

const FAILURE_EVENTS = new Set(['failed', 'returned', 'refunded', 'chargeback'])

export default async function PaymentTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const me = await requireAuth()
  if (!me.is_staff && !me.is_company_admin && !me.is_platform_operator) redirect('/portal')
  const { id } = await params
  const supabase = await createClient()
  const db = supabase as any

  const { data: intent } = await db
    .from('payment_intents')
    .select('*, owners(full_name, email), units(unit_number), associations(name)')
    .eq('id', id)
    .maybeSingle()
  if (!intent) notFound()

  const [{ data: events }, { data: payout }] = await Promise.all([
    db.from('payment_events').select('event, detail, created_at').eq('payment_intent_id', id).order('created_at'),
    intent.processor_payout_id
      ? db.from('payout_batches').select('processor_payout_id, status, arrival_date, bank_transaction_id, matched_at').eq('processor_payout_id', intent.processor_payout_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const tone =
    intent.status === 'succeeded' ? 'success'
    : ['failed', 'returned', 'chargeback'].includes(intent.status) ? 'danger'
    : intent.status === 'processing' ? 'info' : 'neutral'

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/command-center" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-950 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Command Center
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">
              {money(Number(intent.amount))} — {intent.owners?.full_name ?? 'Owner'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Unit {intent.units?.unit_number ?? '—'} · {intent.associations?.name ?? '—'} · {(intent.method ?? 'online').toUpperCase()}
            </p>
          </div>
          <StatusChip tone={tone}>{intent.status}</StatusChip>
        </div>
      </div>

      {/* ── Lifecycle timeline ────────────────────────── */}
      <div className={`${card} p-6`}>
        <h2 className="mb-5 text-sm font-semibold text-gray-950">Payment Lifecycle</h2>
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No lifecycle events recorded for this payment yet.</p>
        ) : (
          <ol className="relative space-y-5 border-l border-gray-200 pl-6">
            {(events ?? []).map((e: any, i: number) => {
              const isFailure = FAILURE_EVENTS.has(e.event)
              const Icon = isFailure ? XCircle : CheckCircle2
              return (
                <li key={i} className="relative">
                  <span className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-white ${isFailure ? 'text-red-500' : 'text-emerald-500'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="text-sm font-medium text-gray-950">{STEP_LABELS[e.event] ?? e.event}</div>
                  {e.detail && <div className="mt-0.5 text-[13px] leading-5 text-gray-500">{e.detail}</div>}
                  <div className="mt-0.5 text-xs tabular-nums text-gray-400">{new Date(e.created_at).toLocaleString('en-US')}</div>
                </li>
              )
            })}
            {intent.status === 'succeeded' && !intent.settled_at && (
              <li className="relative">
                <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-300">
                  <Circle className="h-5 w-5" />
                </span>
                <div className="text-sm font-medium text-gray-400">Stripe payout → bank deposit → reconciled</div>
                <div className="mt-0.5 text-[13px] text-gray-400">Completes automatically when Stripe pays out and the bank feed confirms.</div>
              </li>
            )}
          </ol>
        )}
      </div>

      {/* ── References ────────────────────────────────── */}
      <div className={`${card} p-6`}>
        <h2 className="mb-4 text-sm font-semibold text-gray-950">References</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Stripe Payment Intent</dt><dd className="mt-0.5 font-mono text-xs text-gray-900">{intent.processor_payment_intent_id ?? '—'}</dd></div>
          <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Stripe Payout</dt><dd className="mt-0.5 font-mono text-xs text-gray-900">{intent.processor_payout_id ?? '—'}</dd></div>
          <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Ledger Payment</dt><dd className="mt-0.5 font-mono text-xs text-gray-900">{intent.payment_id ?? '—'}</dd></div>
          <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Processing Fee</dt><dd className="mt-0.5 text-gray-900">{intent.processor_fee_cents != null ? money(intent.processor_fee_cents / 100) : '—'}</dd></div>
          <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Payout Status</dt><dd className="mt-0.5 capitalize text-gray-900">{payout?.status?.replace(/_/g, ' ') ?? '—'}</dd></div>
          <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Bank Match</dt><dd className="mt-0.5 text-gray-900">{payout?.bank_transaction_id ? 'Matched to bank feed' : '—'}</dd></div>
          {intent.failure_reason && (
            <div className="sm:col-span-2"><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Failure Reason</dt><dd className="mt-0.5 text-red-700">{intent.failure_reason}</dd></div>
          )}
        </dl>
      </div>
    </div>
  )
}
