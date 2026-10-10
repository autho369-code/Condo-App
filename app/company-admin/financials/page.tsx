import { glDebitBalances, incomeExpenseTotals, receivableAgingBuckets, unpaidBillsTotal } from '@/lib/finance/totals'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { fiscalMonthsElapsed, fiscalYearFor } from '@/lib/budget/fiscal'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { money } from '@/lib/utils'
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Banknote,
  Receipt,
  AlertTriangle,
  Landmark,
  ArrowRight,
} from 'lucide-react'
import { todayInZone } from '@/lib/time/zoned'
import { Alert } from '@/components/ui/shell'
import { collectLoadErrors } from '@/lib/company-admin/load-errors'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  tone?: 'danger' | 'warning' | 'success'
}) {
  return (
    <div className={`${card} px-4 py-3.5`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-medium leading-5 text-gray-500">{label}</div>
          <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : tone === 'success' ? 'text-emerald-700' : 'text-gray-950'}`}>{value}</div>
          {sub && <div className="mt-1 text-[13px] text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

export default async function FinancialOversightPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  // Calendar dates are the company's zone (server code runs in UTC).
  const todayDate = todayInZone()
  const [year, month, day] = todayDate.split('-').map(Number)
  const today = new Date(year, month - 1, day, 12)
  const monthStart = `${todayDate.slice(0, 7)}-01`
  const yearStart = `${year}-01-01`

  const [
    ytdTotals,
    monthTotals,
    agingBuckets,
    apTotals,
    { data: bills, error: billsError },
    { count: pendingApprovalCount, error: pendingApprovalCountError },
    { count: approvedUnpaidCount, error: approvedUnpaidCountError },
    { rows: lateFees, error: lateFeesError },
    { data: bankAccounts, error: bankAccountsError },
    { data: assocs, error: assocsError },
  ] = await Promise.all([
    // Summed in the database (lists of journal lines stop at 1,000 rows).
    incomeExpenseTotals(db, { portfolioId, from: yearStart }),
    incomeExpenseTotals(db, { portfolioId, from: monthStart }),
    receivableAgingBuckets(db),
    // Open-bill total and counts come from the database; the table shows the
    // 100 bills due soonest.
    unpaidBillsTotal(db, portfolioId),
    db.from('payable_bills').select('id, amount, credit_applied, status, due_date, vendor_id, vendors(name)').eq('portfolio_id', portfolioId).is('archived_at', null).not('status', 'in', '("paid","void")').order('due_date', { ascending: true, nullsFirst: false }).limit(100),
    db.from('payable_bills').select('id', { count: 'exact', head: true }).eq('portfolio_id', portfolioId).is('archived_at', null).eq('status', 'pending_approval'),
    db.from('payable_bills').select('id', { count: 'exact', head: true }).eq('portfolio_id', portfolioId).is('archived_at', null).eq('status', 'approved'),
    fetchAllRows(() => db.from('charges').select('id, amount, due_date').eq('charge_type', 'late_fee').gte('due_date', yearStart).order('id')),
    db.from('bank_accounts').select('id, name, bank_name, account_type, purpose, gl_account_id, last_reconciliation_date, auto_reconciliation').eq('portfolio_id', portfolioId).is('archived_at', null),
    db.from('associations').select('id, name, slug, fiscal_year_start').eq('portfolio_id', portfolioId).is('archived_at', null).order('name'),
  ])

  // ── Income / expense rollups from the posted ledger ──────────
  const ytdIncome = ytdTotals.income
  const ytdExpense = ytdTotals.expense
  const moIncome = monthTotals.income
  const moExpense = monthTotals.expense
  // Bank balances are all-time (they were YTD-only, dropping opening balances).
  const balanceByGl = await glDebitBalances(db, {
    portfolioId,
    glAccountIds: [...new Set((bankAccounts ?? []).map((b: any) => b.gl_account_id).filter(Boolean))] as string[],
  })

  // ── Receivables ──────────────────────────────────────────────
  const arTotal = Object.values(agingBuckets).reduce((s, v) => s + v, 0)
  const delinquent = ['31_60', '61_90', '90_plus'].reduce((s, k) => s + (agingBuckets[k] ?? 0), 0)
  const collectionPct = arTotal > 0 ? Math.round(((arTotal - delinquent) / arTotal) * 100) : 100

  // ── Payables ─────────────────────────────────────────────────
  const openBills = bills ?? []
  const apTotal = apTotals.total

  // ── Late fees YTD ────────────────────────────────────────────
  const lateFeeTotal = lateFees.reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0)

  // ── Budget performance (each association's current fiscal year) ──
  const budgetReports = await Promise.all(
    (assocs ?? []).map(async (a: any) => {
      const fy = fiscalYearFor(today, a.fiscal_year_start)
      const { data, error } = await db.rpc('get_budget_vs_actuals', { p_association_id: a.id, p_fiscal_year: fy })
      return { assoc: a, rows: (data ?? []) as any[], error: error ? `${a.name}: ${error.message}` : null, elapsed: fiscalMonthsElapsed(fy, a.fiscal_year_start, today) }
    }),
  )
  const budgetError = budgetReports.map((r) => r.error).filter(Boolean).join('; ') || null
  const loadErrors = collectLoadErrors({
    'Open bills': { error: billsError },
    'Bills awaiting approval': { error: pendingApprovalCountError },
    'Approved bills': { error: approvedUnpaidCountError },
    'Late fees': { error: lateFeesError },
    'Bank accounts': { error: bankAccountsError },
    Associations: { error: assocsError },
    Budgets: { error: budgetError },
  })
  const ytd = (rows: any[], category: string, key: 'monthly_budget' | 'monthly_actuals', elapsed: number) =>
    rows.filter((r) => r.category === category).reduce(
      (s, r) => s + (r[key] ?? []).slice(0, elapsed).reduce((a: number, b: number) => a + Number(b ?? 0), 0), 0)
  const budgetRows = budgetReports.map(({ assoc, rows, elapsed }) => {
    const incomeBudget = ytd(rows, 'income', 'monthly_budget', elapsed)
    const incomeActual = ytd(rows, 'income', 'monthly_actuals', elapsed)
    const expenseBudget = ytd(rows, 'expense', 'monthly_budget', elapsed)
    const expenseActual = ytd(rows, 'expense', 'monthly_actuals', elapsed)
    const overBudget = expenseBudget > 0 && expenseActual > expenseBudget
    return { assoc, incomeBudget, incomeActual, expenseBudget, expenseActual, overBudget }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Financial Oversight</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Company-wide financials across every association — from the posted ledger
        </p>
      </div>

      {loadErrors.length > 0 && <Alert tone="danger" title="Some financial data could not be loaded; figures below may be incomplete.">{loadErrors.join(' · ')}</Alert>}

      {/* ── KPI grid ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Monthly Income" value={money(moIncome)} sub={`${money(ytdIncome)} YTD`} icon={DollarSign} />
        <StatCard label="Monthly Expenses" value={money(moExpense)} sub={`${money(ytdExpense)} YTD`} icon={TrendingDown} />
        <StatCard label="Net (Month)" value={money(moIncome - moExpense)} sub={`${money(ytdIncome - ytdExpense)} YTD`} icon={TrendingUp} tone={moIncome - moExpense >= 0 ? 'success' : 'danger'} />
        <StatCard label="Accounts Receivable" value={money(arTotal)} icon={Banknote} tone={arTotal > 0 ? 'warning' : undefined} />
        <StatCard label="Delinquencies (31d+)" value={money(delinquent)} icon={AlertTriangle} tone={delinquent > 0 ? 'danger' : undefined} />
        <StatCard label="Collection Progress" value={`${collectionPct}%`} sub="Share of A/R not yet 31+ days late" icon={TrendingUp} />
        <StatCard label="Accounts Payable" value={money(apTotal)} sub={`${pendingApprovalCount ?? 0} awaiting approval · ${approvedUnpaidCount ?? 0} approved`} icon={Receipt} />
        <StatCard label="Late Fees (YTD)" value={money(lateFeeTotal)} icon={DollarSign} />
      </div>

      {/* ── Vendor bills ──────────────────────────────── */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Open Vendor Bills</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Bills awaiting approval or payment across the portfolio
              {apTotals.count > openBills.length ? ` — showing the ${openBills.length} due soonest of ${apTotals.count}` : ''}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Vendor</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Due</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Status</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {openBills.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No open vendor bills.</td></tr>
              ) : (
                openBills.map((b: any, i: number) => (
                  <tr key={b.id ?? i} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3 font-medium text-gray-900">{b.vendors?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm tabular-nums text-gray-700">{b.due_date ?? '—'}</td>
                    <td className="px-5 py-3.5"><StatusChip tone={b.status === 'pending_approval' ? 'warning' : 'info'}>{b.status === 'pending_approval' ? 'Pending approval' : 'Approved'}</StatusChip></td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-gray-950">{money(Number(b.amount ?? 0) - Number(b.credit_applied ?? 0))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Banking ───────────────────────────────────── */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Banking</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Account balances from the posted ledger, with reconciliation status</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Account</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Bank</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Purpose</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Last Reconciled</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Ledger Balance</th>
              </tr>
            </thead>
            <tbody>
              {(bankAccounts ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No bank accounts configured.</td></tr>
              ) : (
                (bankAccounts ?? []).map((b: any) => (
                  <tr key={b.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3 font-medium text-gray-900"><span className="inline-flex items-center gap-2"><Landmark className="h-3.5 w-3.5 text-gray-400" />{b.name}</span></td>
                    <td className="px-5 py-3.5 text-sm text-gray-700">{b.bank_name ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] capitalize text-gray-700">{b.purpose ?? b.account_type ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm tabular-nums text-gray-700">{b.last_reconciliation_date ?? 'Never'}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-gray-950">{b.gl_account_id ? money(balanceByGl.get(b.gl_account_id) ?? 0) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Budget performance ────────────────────────── */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Budget Performance — Current Fiscal Year</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Year-to-date budget vs actual per association</p>
          </div>
          <Link href="/budget-vs-actuals" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            Full budget report <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Association</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Income Budget (YTD)</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Income Actual</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Expense Budget (YTD)</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Expense Actual</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {budgetRows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">No associations found.</td></tr>
              ) : (
                budgetRows.map(({ assoc, incomeBudget, incomeActual, expenseBudget, expenseActual, overBudget }) => (
                  <tr key={assoc.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3.5">
                      <Link href={`/associations/${assoc.slug ?? assoc.id}/budget`} className="font-medium text-gray-900 hover:underline">{assoc.name}</Link>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{money(incomeBudget)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{money(incomeActual)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{money(expenseBudget)}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${overBudget ? 'font-medium text-red-700' : 'text-gray-700'}`}>{money(expenseActual)}</td>
                    <td className="px-5 py-3.5">
                      <StatusChip tone={overBudget ? 'danger' : 'success'}>{overBudget ? 'Over budget' : 'On track'}</StatusChip>
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
