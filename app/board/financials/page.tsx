import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date, money } from '@/lib/utils'
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
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
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
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Financials</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Association financial overview</p>
        </div>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No associations assigned to your board membership.</p>
        </div>
      </div>
    )
  }

  const today = new Date()
  const currentYear = today.getFullYear()
  const yearStart = `${currentYear}-01-01`

  // ── YTD Income & Expenses from posted journal lines ──
  // income accounts: credit increases; expense accounts: debit increases
  let ytdIncome = 0
  let ytdExpenses = 0
  try {
    const { data: pnlLines } = await db
      .from('journal_lines')
      .select('debit_amount, credit_amount, gl_accounts!inner(account_type), journal_entries!inner(entry_date, posted)')
      .in('association_id', boardAssocIds)
      .in('gl_accounts.account_type', ['income', 'other_income', 'expense', 'other_expense'])
      .eq('journal_entries.posted', true)
      .gte('journal_entries.entry_date', yearStart)
    for (const l of pnlLines ?? []) {
      const t = l.gl_accounts?.account_type
      const debit = Number(l.debit_amount ?? 0)
      const credit = Number(l.credit_amount ?? 0)
      if (t === 'income' || t === 'other_income') ytdIncome += credit - debit
      else ytdExpenses += debit - credit
    }
  } catch { /* may not exist */ }

  const netOperatingIncome = ytdIncome - ytdExpenses

  // ── Bank & Reserve balances: roll up posted journal lines on each
  //    bank account's linked GL account ──
  let bankBalance = 0
  let reserveBalance = 0
  try {
    const { data: accounts } = await db
      .from('bank_accounts')
      .select('id, gl_account_id, purpose')
      .in('association_id', boardAssocIds)
      .is('archived_at', null)
    const glIds = (accounts ?? []).map((a: any) => a.gl_account_id).filter(Boolean)
    if (glIds.length > 0) {
      const { data: cashLines } = await db
        .from('journal_lines')
        .select('gl_account_id, debit_amount, credit_amount, journal_entries!inner(posted)')
        .in('gl_account_id', glIds)
        .in('association_id', boardAssocIds)
        .eq('journal_entries.posted', true)
      const balByGl: Record<string, number> = {}
      for (const l of cashLines ?? []) {
        balByGl[l.gl_account_id] = (balByGl[l.gl_account_id] ?? 0) + Number(l.debit_amount ?? 0) - Number(l.credit_amount ?? 0)
      }
      for (const a of accounts ?? []) {
        const bal = balByGl[a.gl_account_id] ?? 0
        bankBalance += bal
        if (a.purpose === 'reserve') reserveBalance += bal
      }
    }
  } catch { /* may not exist */ }

  // ── Budget Variance: budget_lines (expense) vs YTD actual expenses ──
  let budgetVariancePct = 0
  try {
    const { data: budgetLines } = await db
      .from('budget_lines')
      .select('annual_total, category')
      .in('association_id', boardAssocIds)
      .eq('fiscal_year', currentYear)
      .eq('category', 'expense')
    const totalBudgeted = (budgetLines ?? []).reduce((sum: number, b: any) => sum + Number(b.annual_total ?? 0), 0)
    // Pro-rate annual budget to elapsed months so YTD vs YTD is fair
    const elapsedMonths = today.getMonth() + 1
    const budgetToDate = totalBudgeted * (elapsedMonths / 12)
    if (budgetToDate > 0) {
      budgetVariancePct = Math.round(((ytdExpenses - budgetToDate) / budgetToDate) * 100)
    }
  } catch { /* may not exist */ }

  // ── Recent Transactions: latest posted journal lines ──
  let recentTransactions: any[] = []
  try {
    const { data: txns } = await db
      .from('journal_lines')
      .select('id, memo, debit_amount, credit_amount, created_at, association_id, associations(name), journal_entries!inner(description, entry_date, posted)')
      .in('association_id', boardAssocIds)
      .eq('journal_entries.posted', true)
      .order('created_at', { ascending: false })
      .limit(20)
    recentTransactions = (txns ?? []).map((l: any) => {
      const debit = Number(l.debit_amount ?? 0)
      const credit = Number(l.credit_amount ?? 0)
      return {
        id: l.id,
        description: l.memo || l.journal_entries?.description || 'Journal entry',
        amount: debit > 0 ? debit : credit,
        type: debit > 0 ? 'debit' : 'credit',
        created_at: l.journal_entries?.entry_date ?? l.created_at,
        associations: l.associations,
      }
    })
  } catch { /* may not exist */ }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Financials</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Financial overview for your association{boardAssocIds.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Financial Summary Cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="YTD Income"
          value={money(ytdIncome)}
          sub="Charges & management fees"
          icon={TrendingUp}
        />
        <StatCard
          label="YTD Expenses"
          value={money(ytdExpenses)}
          sub="Bills & payments"
          icon={TrendingDown}
        />
        <StatCard
          label="Net Operating Income"
          value={money(netOperatingIncome)}
          sub={`${currentYear} year-to-date`}
          icon={DollarSign}
          valueClass={netOperatingIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}
        />
        <StatCard
          label="Bank Balance"
          value={money(bankBalance)}
          sub="All accounts"
          icon={Building2}
        />
        <StatCard
          label="Reserve Balance"
          value={money(reserveBalance)}
          sub="Reserve accounts"
          icon={PiggyBank}
        />
        <StatCard
          label="Budget Variance"
          value={`${budgetVariancePct >= 0 ? '+' : ''}${budgetVariancePct}%`}
          sub={`vs. ${currentYear} budget`}
          icon={AlertTriangle}
          valueClass={Math.abs(budgetVariancePct) <= 5 ? 'text-emerald-700' : Math.abs(budgetVariancePct) <= 15 ? 'text-amber-700' : 'text-red-700'}
        />
      </div>

      {/* ── Income vs Expenses Bar ── */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Recent Transactions</h2>
            <p className="mt-0.5 text-xs text-gray-500">Latest financial activity across your associations</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Date</th>
                <th className="px-5 py-2.5 text-left font-medium">Description</th>
                <th className="px-5 py-2.5 text-left font-medium">Type</th>
                <th className="px-5 py-2.5 text-left font-medium">Association</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No recent transactions available.</td></tr>
              ) : (
                recentTransactions.map((txn: any) => (
                  <tr key={txn.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(txn.created_at)}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-900">{txn.description ?? '—'}</td>
                    <td className="px-5 py-3">
                      <StatusChip tone={txn.type === 'credit' || txn.type === 'income' ? 'success' : 'danger'}>
                        {txn.type ?? '—'}
                      </StatusChip>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{txn.associations?.name ?? '—'}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${txn.type === 'credit' || txn.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
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
