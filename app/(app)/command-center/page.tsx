import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { Button } from '@/components/ui/button'
import { date, money } from '@/lib/utils'
import { isStripeConfigured } from '@/lib/payments/stripe'
import {
  Banknote,
  Landmark,
  RefreshCcw,
  AlertTriangle,
  TrendingUp,
  CreditCard,
  Undo2,
  PiggyBank,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

async function runMatching() {
  'use server'
  const { requireStaff: req } = await import('@/lib/auth/me')
  await req()
  const { createServiceClient } = await import('@/lib/supabase/server')
  const { reconcilePayouts } = await import('@/lib/payments/reconcile')
  await reconcilePayouts(createServiceClient() as any)
  revalidatePath('/command-center')
}

function Tile({ label, value, sub, icon: Icon, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ElementType; tone?: 'danger' | 'warning' | 'success' }) {
  return (
    <div className={`${card} px-4 py-3.5`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : tone === 'success' ? 'text-emerald-700' : 'text-gray-950'}`}>{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

export default async function FinancialCommandCenterPage() {
  await requireStaff()
  const supabase = await createClient()
  const db = supabase as any
  const todayDate = new Date().toISOString().slice(0, 10)
  const monthStart = todayDate.slice(0, 8) + '01'
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { data: paymentsToday },
    { data: intents },
    { data: aging },
    { data: chargesMonth },
    { data: paymentsMonth },
    { data: bankTxns },
    { data: payouts },
    { data: bankAccounts },
    { data: bankLines },
  ] = await Promise.all([
    db.from('payments').select('amount').eq('payment_date', todayDate),
    db.from('payment_intents').select('id, amount, status, method, failure_reason, created_at, units(unit_number), owners(full_name)').gte('created_at', d30).order('created_at', { ascending: false }),
    db.from('aged_receivables').select('balance_due'),
    db.from('charges').select('amount').gte('due_date', monthStart).lte('due_date', todayDate),
    db.from('payments').select('amount').gte('payment_date', monthStart),
    db.from('bank_transactions').select('id, amount, date, name, matched_at').gte('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
    db.from('payout_batches').select('id, processor_payout_id, amount, expected_amount, arrival_date, status, match_method, notes, created_at').order('created_at', { ascending: false }).limit(25),
    db.from('bank_accounts').select('gl_account_id, purpose').is('archived_at', null),
    db.from('journal_lines').select('gl_account_id, debit_amount, credit_amount, journal_entries!inner(posted)').eq('journal_entries.posted', true),
  ])

  const stripeOn = isStripeConfigured()
  const collectedToday = (paymentsToday ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
  const pendingACH = (intents ?? []).filter((i: any) => i.status === 'processing')
  const pendingACHTotal = pendingACH.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0)
  const returned = (intents ?? []).filter((i: any) => ['returned', 'failed'].includes(i.status))
  const chargebacks = (intents ?? []).filter((i: any) => i.status === 'chargeback')
  const refunded = (intents ?? []).filter((i: any) => i.status === 'refunded')
  const arTotal = (aging ?? []).reduce((s: number, r: any) => s + Number(r.balance_due ?? 0), 0)

  const billedMonth = (chargesMonth ?? []).reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0)
  const collectedMonth = (paymentsMonth ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
  const collectionRate = billedMonth > 0 ? Math.min(100, Math.round((collectedMonth / billedMonth) * 100)) : null

  const txns = bankTxns ?? []
  const matchedTxns = txns.filter((t: any) => t.matched_at).length
  const autoReconRate = txns.length > 0 ? Math.round((matchedTxns / txns.length) * 100) : null
  const unmatchedDeposits = txns.filter((t: any) => !t.matched_at && Number(t.amount) < 0) // Plaid: negative = inflow
  const needsReviewPayouts = (payouts ?? []).filter((p: any) => p.status === 'needs_review')

  // Operating / reserve balances from posted ledger (same rollup as board financials).
  const balByGl = new Map<string, number>()
  for (const l of bankLines ?? []) {
    balByGl.set(l.gl_account_id, (balByGl.get(l.gl_account_id) ?? 0) + Number(l.debit_amount ?? 0) - Number(l.credit_amount ?? 0))
  }
  let operating = 0
  let reserve = 0
  for (const b of bankAccounts ?? []) {
    const bal = b.gl_account_id ? (balByGl.get(b.gl_account_id) ?? 0) : 0
    if ((b.purpose ?? '').toLowerCase().includes('reserve')) reserve += bal
    else operating += bal
  }

  const exceptions = [
    ...needsReviewPayouts.map((p: any) => ({
      kind: 'Payout needs review',
      detail: `Stripe payout ${money(Number(p.amount))} — ${p.notes ?? 'amount mismatch with expected online payments'}`,
      when: p.arrival_date ?? p.created_at,
      tone: 'warning' as const,
    })),
    ...returned.map((i: any) => ({
      kind: i.status === 'failed' ? 'Payment failed' : 'Payment returned',
      detail: `${i.owners?.full_name ?? 'Owner'} · Unit ${i.units?.unit_number ?? '—'} · ${money(Number(i.amount))}${i.failure_reason ? ` — ${i.failure_reason}` : ''}`,
      when: i.created_at,
      tone: 'danger' as const,
    })),
    ...chargebacks.map((i: any) => ({
      kind: 'Chargeback',
      detail: `${i.owners?.full_name ?? 'Owner'} · ${money(Number(i.amount))} — ${i.failure_reason ?? 'respond in Stripe'}`,
      when: i.created_at,
      tone: 'danger' as const,
    })),
    ...refunded.map((i: any) => ({
      kind: 'Refund posted in Stripe',
      detail: `${i.owners?.full_name ?? 'Owner'} · ${money(Number(i.amount))} — review the owner ledger for an offsetting adjustment`,
      when: i.created_at,
      tone: 'warning' as const,
    })),
    ...unmatchedDeposits.slice(0, 10).map((t: any) => ({
      kind: 'Unmatched bank deposit',
      detail: `${money(Math.abs(Number(t.amount)))} · ${t.name ?? 'Deposit'}`,
      when: t.date,
      tone: 'warning' as const,
    })),
  ].sort((a, b) => String(b.when).localeCompare(String(a.when)))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Financial Command Center</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">
            Collections, settlements, and reconciliation across the portfolio — the ledger is the source of truth; Stripe and the bank feed confirm it
          </p>
        </div>
        <form action={runMatching}>
          <Button type="submit" variant="secondary" className="gap-2"><RefreshCcw className="h-4 w-4" /> Run matching now</Button>
        </form>
      </div>

      {!stripeOn && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
          Online payments are built but dormant — set <code className="rounded bg-blue-100 px-1">STRIPE_SECRET_KEY</code> and{' '}
          <code className="rounded bg-blue-100 px-1">STRIPE_WEBHOOK_SECRET</code> in Vercel to switch them on. Offline
          payments and Plaid bank-feed reconciliation work today.
        </div>
      )}

      {/* ── Metric grid ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        <Tile label="Collected Today" value={money(collectedToday)} icon={Banknote} tone={collectedToday > 0 ? 'success' : undefined} />
        <Tile label="Pending ACH" value={money(pendingACHTotal)} sub={`${pendingACH.length} payment${pendingACH.length === 1 ? '' : 's'} settling`} icon={CreditCard} />
        <Tile label="Returned / Failed (30d)" value={returned.length} icon={Undo2} tone={returned.length > 0 ? 'danger' : undefined} />
        <Tile label="Chargebacks (30d)" value={chargebacks.length} icon={AlertTriangle} tone={chargebacks.length > 0 ? 'danger' : undefined} />
        <Tile label="Outstanding Receivables" value={money(arTotal)} icon={TrendingUp} tone={arTotal > 0 ? 'warning' : undefined} />
        <Tile label="Collection Rate (MTD)" value={collectionRate === null ? '—' : `${collectionRate}%`} sub={billedMonth > 0 ? `${money(collectedMonth)} of ${money(billedMonth)} billed` : 'Nothing billed this month'} icon={TrendingUp} />
        <Tile label="Auto-Reconciliation (30d)" value={autoReconRate === null ? '—' : `${autoReconRate}%`} sub={txns.length > 0 ? `${matchedTxns}/${txns.length} bank transactions matched` : 'No bank feed activity'} icon={RefreshCcw} />
        <Tile label="Unmatched Deposits" value={unmatchedDeposits.length} icon={AlertTriangle} tone={unmatchedDeposits.length > 0 ? 'warning' : undefined} />
        <Tile label="Operating Balance" value={money(operating)} icon={Landmark} />
        <Tile label="Reserve Balance" value={money(reserve)} icon={PiggyBank} />
      </div>

      {/* ── Exception queue ───────────────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Exception Queue</h2>
          <p className="mt-0.5 text-xs text-gray-500">Everything that needs a human — unmatched deposits, mismatched payouts, returns, chargebacks, refunds</p>
        </div>
        {exceptions.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">Nothing needs attention — all money movement is matched.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {exceptions.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <StatusChip tone={e.tone}>{e.kind}</StatusChip>
                  <p className="mt-1 truncate text-[13px] text-gray-700">{e.detail}</p>
                </div>
                <div className="shrink-0 text-[13px] tabular-nums text-gray-500">{date(e.when)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Online payments (30d) ─────────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Online Payments (30 days)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Owner</th>
                <th className="px-5 py-2.5 text-left font-medium">Unit</th>
                <th className="px-5 py-2.5 text-left font-medium">Method</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
                <th className="px-5 py-2.5 text-left font-medium">When</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(intents ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">{stripeOn ? 'No online payments yet.' : 'Online payments appear here once Stripe is enabled.'}</td></tr>
              ) : (
                (intents ?? []).map((i: any) => (
                  <tr key={i.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900">{i.owners?.full_name ?? '—'}</td>
                    <td className="px-5 py-3 tabular-nums text-gray-700">{i.units?.unit_number ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] uppercase text-gray-700">{i.method ?? '—'}</td>
                    <td className="px-5 py-3">
                      <StatusChip tone={i.status === 'succeeded' ? 'success' : ['failed', 'returned', 'chargeback'].includes(i.status) ? 'danger' : i.status === 'processing' ? 'info' : 'neutral'}>
                        {i.status}
                      </StatusChip>
                    </td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(i.created_at)}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-gray-950">{money(Number(i.amount))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Payout batches ────────────────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Stripe Payouts → Bank</h2>
          <p className="mt-0.5 text-xs text-gray-500">Each payout is matched against the online payments it settles and the Plaid bank-feed deposit</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Payout</th>
                <th className="px-5 py-2.5 text-left font-medium">Arrival</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                <th className="px-5 py-2.5 text-right font-medium">Expected</th>
                <th className="px-5 py-2.5 text-left font-medium">Match</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(payouts ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">No processor payouts yet.</td></tr>
              ) : (
                (payouts ?? []).map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-mono text-xs text-gray-700">{p.processor_payout_id}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(p.arrival_date)}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-gray-950">{money(Number(p.amount))}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{p.expected_amount != null ? money(Number(p.expected_amount)) : '—'}</td>
                    <td className="px-5 py-3 text-[13px] capitalize text-gray-700">{(p.match_method ?? '—').replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3">
                      <StatusChip tone={p.status === 'reconciled' ? 'success' : p.status === 'needs_review' || p.status === 'failed' ? 'danger' : 'info'}>
                        {p.status.replace(/_/g, ' ')}
                      </StatusChip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs leading-5 text-gray-400">
        Statement-based reconciliation lives under <Link href="/bank-accounts" className="underline">Bank accounts</Link>;
        the Plaid feed syncs there. This page is the real-time matching layer on top of it.
      </p>
    </div>
  )
}
