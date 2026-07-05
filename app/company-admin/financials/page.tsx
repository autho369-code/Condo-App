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

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

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

export default async function FinancialOversightPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const today = new Date()
  const year = today.getFullYear()
  const monthStart = `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const yearStart = `${year}-01-01`

  const [
    { data: journalLines },
    { data: aging },
    { data: bills },
    { data: lateFees },
    { data: bankAccounts },
    { data: assocs },
  ] = await Promise.all([
    // Posted journal activity YTD with account type + entry date for income/expense rollups.
    db.from('journal_lines')
      .select('debit_amount, credit_amount, gl_account_id, journal_entries!inner(entry_date, posted, portfolio_id), gl_accounts!inner(account_type, name, number)')
      .eq('journal_entries.portfolio_id', portfolioId)
      .eq('journal_entries.posted', true)
      .gte('journal_entries.entry_date', yearStart),
    db.from('aged_receivables').select('balance_due, aging_bucket'),
    db.from('payable_bills').select('amount, status, due_date, vendor_id, vendors(name)').eq('portfolio_id', portfolioId).is('archived_at', null),
    db.from('charges').select('amount, due_date').eq('charge_type', 'late_fee').gte('due_date', yearStart),
    db.from('bank_accounts').select('id, name, bank_name, account_type, purpose, gl_account_id, last_reconciliation_date, auto_reconciliation').eq('portfolio_id', portfolioId).is('archived_at', null),
    db.from('associations').select('id, name, slug').eq('portfolio_id', portfolioId).is('archived_at', null).order('name'),
  ])

  // ── Income / expense rollups from the posted ledger ──────────
  let ytdIncome = 0, ytdExpense = 0, moIncome = 0, moExpense = 0
  const balanceByGl = new Map<string, number>()
  for (const l of journalLines ?? []) {
    const debit = Number(l.debit_amount ?? 0)
    const credit = Number(l.credit_amount ?? 0)
    const type = l.gl_accounts?.account_type
    const entryDate = l.journal_entries?.entry_date ?? ''
    const inMonth = entryDate >= monthStart
    if (type === 'income') {
      ytdIncome += credit - debit
      if (inMonth) moIncome += credit - debit
    } else if (type === 'expense') {
      ytdExpense += debit - credit
      if (inMonth) moExpense += debit - credit
    }
    balanceByGl.set(l.gl_account_id, (balanceByGl.get(l.gl_account_id) ?? 0) + debit - credit)
  }

  // ── Receivables ──────────────────────────────────────────────
  const arTotal = (aging ?? []).reduce((s: number, r: any) => s + Number(r.balance_due ?? 0), 0)
  const delinquent = (aging ?? [])
    .filter((r: any) => ['31_60', '61_90', '90_plus'].includes(r.aging_bucket))
    .reduce((s: number, r: any) => s + Number(r.balance_due ?? 0), 0)
  const collectionPct = arTotal > 0 ? Math.round(((arTotal - delinquent) / arTotal) * 100) : 100

  // ── Payables ─────────────────────────────────────────────────
  const openBills = (bills ?? []).filter((b: any) => !['paid', 'void'].includes(b.status))
  const apTotal = openBills.reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0)
  const pendingApproval = (bills ?? []).filter((b: any) => b.status === 'pending_approval')
  const approvedUnpaid = (bills ?? []).filter((b: any) => b.status === 'approved')

  // ── Late fees YTD ────────────────────────────────────────────
  const lateFeeTotal = (lateFees ?? []).reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0)

  // ── Budget performance (portfolio-wide, current fiscal year) ──
  const currentMonth = today.getMonth() + 1
  const budgetReports = await Promise.all(
    (assocs ?? []).map(async (a: any) => {
      const { data } = await db.rpc('get_budget_vs_actuals', { p_association_id: a.id, p_fiscal_year: year })
      return { assoc: a, rows: (data ?? []) as any[] }
    }),
  )
  const ytd = (rows: any[], category: string, key: 'monthly_budget' | 'monthly_actuals') =>
    rows.filter((r) => r.category === category).reduce(
      (s, r) => s + (r[key] ?? []).slice(0, currentMonth).reduce((a: number, b: number) => a + (b ?? 0), 0), 0)
  const budgetRows = budgetReports.map(({ assoc, rows }) => {
    const incomeBudget = ytd(rows, 'income', 'monthly_budget')
    const incomeActual = ytd(rows, 'income', 'monthly_actuals')
    const expenseBudget = ytd(rows, 'expense', 'monthly_budget')
    const expenseActual = ytd(rows, 'expense', 'monthly_actuals')
    const overBudget = expenseBudget > 0 && expenseActual > expenseBudget
    return { assoc, incomeBudget, incomeActual, expenseBudget, expenseActual, overBudget }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Financial Oversight</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Company-wide financials across every association — from the posted ledger
        </p>
      </div>

      {/* ── KPI grid ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Monthly Income" value={money(moIncome)} sub={`${money(ytdIncome)} YTD`} icon={DollarSign} />
        <StatCard label="Monthly Expenses" value={money(moExpense)} sub={`${money(ytdExpense)} YTD`} icon={TrendingDown} />
        <StatCard label="Net (Month)" value={money(moIncome - moExpense)} sub={`${money(ytdIncome - ytdExpense)} YTD`} icon={TrendingUp} tone={moIncome - moExpense >= 0 ? 'success' : 'danger'} />
        <StatCard label="Accounts Receivable" value={money(arTotal)} icon={Banknote} tone={arTotal > 0 ? 'warning' : undefined} />
        <StatCard label="Delinquencies (31d+)" value={money(delinquent)} icon={AlertTriangle} tone={delinquent > 0 ? 'danger' : undefined} />
        <StatCard label="Collection Progress" value={`${collectionPct}%`} sub="Share of A/R not yet 31+ days late" icon={TrendingUp} />
        <StatCard label="Accounts Payable" value={money(apTotal)} sub={`${pendingApproval.length} awaiting approval · ${approvedUnpaid.length} approved`} icon={Receipt} />
        <StatCard label="Late Fees (YTD)" value={money(lateFeeTotal)} icon={DollarSign} />
      </div>

      {/* ── Vendor bills ──────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Open Vendor Bills</h2>
            <p className="mt-0.5 text-xs text-gray-500">Bills awaiting approval or payment across the portfolio</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Vendor</th>
                <th className="px-5 py-2.5 text-left font-medium">Due</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {openBills.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No open vendor bills.</td></tr>
              ) : (
                openBills.map((b: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900">{b.vendors?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{b.due_date ?? '—'}</td>
                    <td className="px-5 py-3"><StatusChip tone={b.status === 'pending_approval' ? 'warning' : 'info'}>{b.status === 'pending_approval' ? 'Pending approval' : 'Approved'}</StatusChip></td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-gray-950">{money(Number(b.amount ?? 0))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Banking ───────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Banking</h2>
            <p className="mt-0.5 text-xs text-gray-500">Account balances from the posted ledger, with reconciliation status</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Account</th>
                <th className="px-5 py-2.5 text-left font-medium">Bank</th>
                <th className="px-5 py-2.5 text-left font-medium">Purpose</th>
                <th className="px-5 py-2.5 text-left font-medium">Last Reconciled</th>
                <th className="px-5 py-2.5 text-right font-medium">Ledger Balance</th>
              </tr>
            </thead>
            <tbody>
              {(bankAccounts ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No bank accounts configured.</td></tr>
              ) : (
                (bankAccounts ?? []).map((b: any) => (
                  <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900"><span className="inline-flex items-center gap-2"><Landmark className="h-3.5 w-3.5 text-gray-400" />{b.name}</span></td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{b.bank_name ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] capitalize text-gray-700">{b.purpose ?? b.account_type ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{b.last_reconciliation_date ?? 'Never'}</td>
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
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Budget Performance — FY{year}</h2>
            <p className="mt-0.5 text-xs text-gray-500">Year-to-date budget vs actual per association</p>
          </div>
          <Link href="/budget-vs-actuals" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            Full budget report <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Association</th>
                <th className="px-5 py-2.5 text-right font-medium">Income Budget (YTD)</th>
                <th className="px-5 py-2.5 text-right font-medium">Income Actual</th>
                <th className="px-5 py-2.5 text-right font-medium">Expense Budget (YTD)</th>
                <th className="px-5 py-2.5 text-right font-medium">Expense Actual</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {budgetRows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">No associations found.</td></tr>
              ) : (
                budgetRows.map(({ assoc, incomeBudget, incomeActual, expenseBudget, expenseActual, overBudget }) => (
                  <tr key={assoc.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/associations/${assoc.slug ?? assoc.id}/budget`} className="font-medium text-gray-900 hover:underline">{assoc.name}</Link>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{money(incomeBudget)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{money(incomeActual)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{money(expenseBudget)}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${overBudget ? 'font-medium text-red-700' : 'text-gray-700'}`}>{money(expenseActual)}</td>
                    <td className="px-5 py-3">
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
