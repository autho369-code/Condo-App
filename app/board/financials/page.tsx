import { glDebitBalances, incomeExpenseTotals } from '@/lib/finance/totals'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { ExportActions, type ExportTable } from '@/components/export/export-actions'
import { date, money } from '@/lib/utils'
import { fiscalMonthsElapsed, fiscalWindow, fiscalYearFor } from '@/lib/budget/fiscal'
import { DEFAULT_TIME_ZONE, todayInZone } from '@/lib/time/zoned'
import { Alert } from '@/components/ui/shell'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  PiggyBank,
  AlertTriangle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  valueClass = 'text-gray-950',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  valueClass?: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-gray-500">{label}</div>
          <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
          {sub && <div className="mt-1 text-[13px] text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

export default async function BoardFinancialsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const boardAssocIds = me.board_association_ids ?? []

  if (boardAssocIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Financials</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Association financial overview</p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No associations assigned to your board membership.</p>
        </div>
      </div>
    )
  }

  // Finalized year-end packages (RLS exposes only finalized packages to the board).
  const loadErrors: string[] = []
  const { data: yearEndRows, error: yearEndError } = await db
    .from('year_end_packages')
    .select('id, fiscal_year, associations(name)')
    .in('association_id', boardAssocIds)
    .eq('status', 'finalized')
    .order('fiscal_year', { ascending: false })
    .limit(20)
  if (yearEndError) loadErrors.push(`Year-end packages could not be loaded: ${yearEndError.message}`)
  const yearEndPackages = (yearEndRows ?? []) as any[]

  const today = new Date()
  const currentYear = today.getFullYear()

  // Each association's current fiscal year (fiscal_year_start month).
  // "Today" is the association's local date, and YTD stops there.
  const { data: fiscalRows, error: fiscalError } = await db
    .from('associations')
    .select('id, fiscal_year_start, timezone')
    .in('id', boardAssocIds)
  if (fiscalError) loadErrors.push(`Fiscal years could not be loaded: ${fiscalError.message}`)
  const fiscal = ((fiscalRows ?? []) as { id: string; fiscal_year_start: number | null; timezone: string | null }[]).map((a) => {
    const localToday = todayInZone(a.timezone || DEFAULT_TIME_ZONE)
    const localDate = new Date(`${localToday}T12:00:00`)
    const fy = fiscalYearFor(localDate, a.fiscal_year_start)
    return { id: a.id, fy, start: fiscalWindow(fy, a.fiscal_year_start).start, to: localToday, elapsed: fiscalMonthsElapsed(fy, a.fiscal_year_start, localDate) }
  })
  const fiscalYears = [...new Set(fiscal.map((f) => f.fy))]
  const fyLabel = fiscalYears.length === 1 ? `FY${fiscalYears[0]}` : 'fiscal'

  // ── Fiscal YTD Income & Expenses from posted journal lines ──
  // income accounts: credit increases; expense accounts: debit increases
  let ytdIncome = 0
  let ytdExpenses = 0
  let ytdFailed = false
  try {
    // Summed in the database (a list of journal lines stops at 1,000 rows).
    const totals = await Promise.all(fiscal.map((f) => incomeExpenseTotals(db, { associationIds: [f.id], from: f.start, to: f.to })))
    for (const t of totals) {
      ytdIncome += t.income
      ytdExpenses += t.expense
    }
  } catch (e) {
    ytdFailed = true
    loadErrors.push(e instanceof Error ? e.message : String(e))
  }

  const netOperatingIncome = ytdIncome - ytdExpenses

  // ── Bank & Reserve balances: roll up posted journal lines on each
  //    bank account's linked GL account ──
  let bankBalance = 0
  let reserveBalance = 0
  let balancesFailed = false
  const { data: accounts, error: accountsError } = await db
    .from('bank_accounts')
    .select('id, gl_account_id, purpose, fund_type')
    .in('association_id', boardAssocIds)
    .is('archived_at', null)
  if (accountsError) {
    balancesFailed = true
    loadErrors.push(`Bank accounts could not be loaded: ${accountsError.message}`)
  }
  const glIds = [...new Set((accounts ?? []).map((a: any) => a.gl_account_id).filter(Boolean))] as string[]
  try {
    if (glIds.length > 0) {
      const balByGl = await glDebitBalances(db, { glAccountIds: glIds, associationIds: boardAssocIds })
      for (const a of accounts ?? []) {
        const bal = balByGl.get(a.gl_account_id) ?? 0
        bankBalance += bal
        if (a.fund_type === 'reserve' || (a.purpose ?? '').toLowerCase().includes('reserve')) reserveBalance += bal
      }
    }
  } catch (e) {
    balancesFailed = true
    loadErrors.push(e instanceof Error ? e.message : String(e))
  }

  // ── Budget Variance: fiscal-YTD expense budget vs actual, per association ──
  let budgetVariancePct = 0
  let varianceFailed = false
  {
    let budgetToDate = 0
    let actualToDate = 0
    const reports = await Promise.all(fiscal.map(async (f) => {
      const { data, error } = await db.rpc('get_budget_vs_actuals', { p_association_id: f.id, p_fiscal_year: f.fy })
      if (error) {
        varianceFailed = true
        loadErrors.push(`Budget vs actual could not be loaded: ${error.message}`)
      }
      return { rows: (error ? [] : data ?? []) as any[], elapsed: f.elapsed }
    }))
    for (const { rows, elapsed } of reports) {
      for (const r of rows.filter((x) => x.category === 'expense')) {
        budgetToDate += (r.monthly_budget ?? []).slice(0, elapsed).reduce((t: number, v: any) => t + Number(v ?? 0), 0)
        actualToDate += (r.monthly_actuals ?? []).slice(0, elapsed).reduce((t: number, v: any) => t + Number(v ?? 0), 0)
      }
    }
    if (budgetToDate > 0) {
      budgetVariancePct = Math.round(((actualToDate - budgetToDate) / budgetToDate) * 100)
    }
  }

  // ── Recent Transactions: one row per posted entry that touched a bank
  //    account's cash GL account. Debit to cash = money in (positive),
  //    credit to cash = money out (negative). Showing every line of an entry
  //    listed both halves of the same transaction.
  let recentTransactions: any[] = []
  let transactionsFailed = false
  if (glIds.length > 0) {
    const { data: txns, error: txnError } = await db
      .from('journal_lines')
      .select('id, entry_id, memo, debit_amount, credit_amount, created_at, association_id, associations(name), journal_entries!inner(description, entry_date, posted)')
      .in('association_id', boardAssocIds)
      .in('gl_account_id', glIds)
      .eq('journal_entries.posted', true)
      // Newest by accounting date, not by when the line was keyed in.
      .order('journal_entries(entry_date)', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(60)
    if (txnError) {
      transactionsFailed = true
      loadErrors.push(`Recent transactions could not be loaded: ${txnError.message}`)
    }
    const byEntry = new Map<string, any>()
    for (const l of (txns ?? []) as any[]) {
      const net = Number(l.debit_amount ?? 0) - Number(l.credit_amount ?? 0)
      const key = l.entry_id ?? l.id
      const row = byEntry.get(key)
      if (row) {
        row.amount += net // e.g. a transfer between two bank accounts nets out
        continue
      }
      byEntry.set(key, {
        id: key,
        description: l.journal_entries?.description || l.memo || 'Journal entry',
        amount: net,
        created_at: l.journal_entries?.entry_date ?? l.created_at,
        associations: l.associations,
      })
    }
    recentTransactions = [...byEntry.values()].slice(0, 20).map((t) => ({
      ...t,
      type: t.amount > 0 ? 'inflow' : t.amount < 0 ? 'outflow' : 'transfer',
    }))
  }

  // ── Export setup: association names for the white-label header, plus the
  //    exact rows rendered below mapped to pre-rendered strings ──
  const { data: assocNameRows } = await db
    .from('associations')
    .select('name')
    .in('id', boardAssocIds)
  const associationNames = (assocNameRows ?? [])
    .map((a: any) => a.name)
    .filter(Boolean)
    .join(', ')

  const exportDate = `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const exportTables: ExportTable[] = [
    {
      title: `Financial Summary (${fyLabel} YTD)`,
      columns: [{ header: 'Metric' }, { header: 'Value', align: 'right' }],
      rows: [
        ['YTD Income', money(ytdIncome)],
        ['YTD Expenses', money(ytdExpenses)],
        ['Net Operating Income', money(netOperatingIncome)],
        ['Bank Balance', money(bankBalance)],
        ['Reserve Balance', money(reserveBalance)],
        ['Budget Variance', `${budgetVariancePct >= 0 ? '+' : ''}${budgetVariancePct}%`],
      ],
    },
    {
      title: 'Recent Transactions',
      columns: [
        { header: 'Date' },
        { header: 'Description' },
        { header: 'Type' },
        { header: 'Association' },
        { header: 'Amount', align: 'right' },
      ],
      rows: recentTransactions.map((txn: any) => [
        date(txn.created_at),
        txn.description ?? '—',
        txn.type ?? '—',
        txn.associations?.name ?? '—',
        money(txn.amount),
      ]),
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Financials</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
            Financial overview for your association{boardAssocIds.length > 1 ? 's' : ''}
          </p>
        </div>
        <ExportActions
          documentTitle="Financials"
          subtitle={associationNames || undefined}
          companyName={me.portfolio?.company_name ?? associationNames}
          filename={`financials-${exportDate}`}
          tables={exportTables}
          footerLine={`Net operating income (${fyLabel} YTD): ${money(netOperatingIncome)}`}
        />
      </div>

      {loadErrors.map((msg) => <Alert key={msg} tone="danger">{msg}</Alert>)}

      {yearEndPackages.length > 0 && (
        <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-gray-100 px-5 py-3"><h2 className="text-sm font-semibold text-gray-900">Year-end financial packages</h2></div>
          <ul className="divide-y divide-line">
            {yearEndPackages.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-gray-900">{p.associations?.name ?? 'Association'} · FY {p.fiscal_year}</span>
                <Link href={`/board/financials/year-end/${p.id}`} className="font-medium text-gray-600 hover:text-gray-950">Open package</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Financial Summary Cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="YTD Income"
          value={ytdFailed ? '—' : money(ytdIncome)}
          sub="Charges & management fees"
          icon={TrendingUp}
        />
        <StatCard
          label="YTD Expenses"
          value={ytdFailed ? '—' : money(ytdExpenses)}
          sub="Bills & payments"
          icon={TrendingDown}
        />
        <StatCard
          label="Net Operating Income"
          value={ytdFailed ? '—' : money(netOperatingIncome)}
          sub={`${fyLabel} year-to-date`}
          icon={DollarSign}
          valueClass={netOperatingIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}
        />
        <StatCard
          label="Bank Balance"
          value={balancesFailed ? '—' : money(bankBalance)}
          sub="All accounts"
          icon={Building2}
        />
        <StatCard
          label="Reserve Balance"
          value={balancesFailed ? '—' : money(reserveBalance)}
          sub="Reserve accounts"
          icon={PiggyBank}
        />
        <StatCard
          label="Budget Variance"
          value={varianceFailed ? '—' : `${budgetVariancePct >= 0 ? '+' : ''}${budgetVariancePct}%`}
          sub={`vs. ${fyLabel} budget to date`}
          icon={AlertTriangle}
          valueClass={Math.abs(budgetVariancePct) <= 5 ? 'text-emerald-700' : Math.abs(budgetVariancePct) <= 15 ? 'text-amber-700' : 'text-red-700'}
        />
      </div>

      {/* ── Income vs Expenses Bar ── */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-gray-950">Income vs. Expenses (YTD)</h2>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-gray-500">Income</span>
              <span className="tabular-nums text-emerald-700">{money(ytdIncome)}</span>
            </div>
            <div className="h-6 overflow-hidden rounded bg-gray-100">
              <div
                className="h-full rounded bg-emerald-500 transition-all"
                style={{ width: `${ytdIncome > 0 && ytdExpenses > 0 ? Math.min(100, Math.round((ytdIncome / Math.max(ytdIncome, ytdExpenses)) * 100)) : ytdIncome > 0 ? 100 : 0}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-gray-500">Expenses</span>
              <span className="tabular-nums text-red-700">{money(ytdExpenses)}</span>
            </div>
            <div className="h-6 overflow-hidden rounded bg-gray-100">
              <div
                className="h-full rounded bg-red-500 transition-all"
                style={{ width: `${ytdExpenses > 0 ? Math.min(100, Math.round((ytdExpenses / Math.max(ytdIncome, ytdExpenses)) * 100)) : 0}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          Net: {money(netOperatingIncome)} {netOperatingIncome >= 0 ? 'surplus' : 'deficit'}
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Recent Transactions</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Latest money in and out of your association bank accounts</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Date</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Description</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Type</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Association</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">{transactionsFailed ? 'Recent transactions are unavailable right now.' : 'No recent transactions available.'}</td></tr>
              ) : (
                recentTransactions.map((txn: any) => (
                  <tr key={txn.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3.5 text-sm tabular-nums text-gray-700">{date(txn.created_at)}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-900">{txn.description ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <StatusChip tone={txn.type === 'inflow' ? 'success' : txn.type === 'outflow' ? 'danger' : 'neutral'}>
                        {txn.type}
                      </StatusChip>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-700">{txn.associations?.name ?? '—'}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${txn.amount > 0 ? 'text-emerald-700' : txn.amount < 0 ? 'text-red-700' : 'text-gray-700'}`}>
                      {money(txn.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
