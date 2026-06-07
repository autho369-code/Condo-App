import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date, money } from '@/lib/utils'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  PiggyBank,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'violet'
}) {
  const accents: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  }
  return (
    <div className="rounded-xl border border-[#1E293B] p-4 transition-colors hover:border-[#334155]" style={{ backgroundColor: '#0B1121' }}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
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
          <h1 className="text-2xl font-bold text-white">Financials</h1>
          <p className="mt-1 text-sm text-slate-400">Association financial overview</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] p-12 text-center" style={{ backgroundColor: '#0B1121' }}>
          <AlertTriangle className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-4 text-slate-400">No associations assigned to your board membership.</p>
        </div>
      </div>
    )
  }

  const today = new Date()
  const currentYear = today.getFullYear()
  const yearStart = `${currentYear}-01-01`

  // ── YTD Income: Sum of charges/management_fees ──
  let ytdIncome = 0
  try {
    const { data: charges } = await db
      .from('charges')
      .select('amount')
      .in('association_id', boardAssocIds)
      .gte('created_at', yearStart)
      .is('archived_at', null)
    ytdIncome = (charges ?? []).reduce((sum: number, c: any) => sum + (c.amount ?? 0), 0)
  } catch { /* table may not exist */ }

  // ── YTD Expenses: Sum of bills/payments ──
  let ytdExpenses = 0
  try {
    const { data: bills } = await db
      .from('bills')
      .select('amount')
      .in('association_id', boardAssocIds)
      .gte('created_at', yearStart)
      .is('archived_at', null)
    ytdExpenses = (bills ?? []).reduce((sum: number, b: any) => sum + (b.amount ?? 0), 0)
  } catch { /* table may not exist */ }

  const netOperatingIncome = ytdIncome - ytdExpenses

  // ── Bank Balance: Sum of bank account balances ──
  let bankBalance = 0
  try {
    const { data: accounts } = await db
      .from('bank_accounts')
      .select('balance')
      .in('association_id', boardAssocIds)
    bankBalance = (accounts ?? []).reduce((sum: number, a: any) => sum + (a.balance ?? 0), 0)
  } catch { /* table may not exist */ }

  // ── Reserve Balance ──
  let reserveBalance = 0
  try {
    const { data: reserves } = await db
      .from('bank_accounts')
      .select('balance')
      .in('association_id', boardAssocIds)
      .eq('account_type', 'reserve')
    reserveBalance = (reserves ?? []).reduce((sum: number, a: any) => sum + (a.balance ?? 0), 0)
  } catch { /* may not exist */ }

  // ── Budget Variance ──
  let budgetVariancePct = 0
  try {
    const { data: budgets } = await db
      .from('budgets')
      .select('budgeted_amount, actual_amount')
      .in('association_id', boardAssocIds)
      .eq('fiscal_year', currentYear)
    const totalBudgeted = (budgets ?? []).reduce((sum: number, b: any) => sum + (b.budgeted_amount ?? 0), 0)
    const totalActual = (budgets ?? []).reduce((sum: number, b: any) => sum + (b.actual_amount ?? 0), 0)
    if (totalBudgeted > 0) {
      budgetVariancePct = Math.round(((totalActual - totalBudgeted) / totalBudgeted) * 100)
    }
  } catch { /* may not exist */ }

  // ── Recent Transactions ──
  let recentTransactions: any[] = []
  try {
    const { data: txns } = await db
      .from('journal_entries')
      .select(`id, description, amount, type, created_at, association_id, associations(name)`)
      .in('association_id', boardAssocIds)
      .order('created_at', { ascending: false })
      .limit(20)
    recentTransactions = txns ?? []
  } catch { /* may not exist */ }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Financials</h1>
        <p className="mt-1 text-sm text-slate-400">
          Financial overview for your association{boardAssocIds.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Financial Summary Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="YTD Income"
          value={money(ytdIncome)}
          sub="Charges & management fees"
          icon={TrendingUp}
          accent="emerald"
        />
        <StatCard
          label="YTD Expenses"
          value={money(ytdExpenses)}
          sub="Bills & payments"
          icon={TrendingDown}
          accent="red"
        />
        <StatCard
          label="Net Operating Income"
          value={money(netOperatingIncome)}
          sub={`${currentYear} year-to-date`}
          icon={DollarSign}
          accent={netOperatingIncome >= 0 ? 'emerald' : 'red'}
        />
        <StatCard
          label="Bank Balance"
          value={money(bankBalance)}
          sub="All accounts"
          icon={Building2}
          accent="blue"
        />
        <StatCard
          label="Reserve Balance"
          value={money(reserveBalance)}
          sub="Reserve accounts"
          icon={PiggyBank}
          accent="violet"
        />
        <StatCard
          label="Budget Variance"
          value={`${budgetVariancePct >= 0 ? '+' : ''}${budgetVariancePct}%`}
          sub={`vs. ${currentYear} budget`}
          icon={AlertTriangle}
          accent={Math.abs(budgetVariancePct) <= 5 ? 'emerald' : Math.abs(budgetVariancePct) <= 15 ? 'amber' : 'red'}
        />
      </div>

      {/* ── Income vs Expenses Bar ── */}
      <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
        <h2 className="mb-4 text-sm font-semibold text-white">Income vs. Expenses (YTD)</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Income</span>
              <span className="text-emerald-400 tabular-nums">{money(ytdIncome)}</span>
            </div>
            <div className="h-6 rounded bg-[#060B18] overflow-hidden">
              <div
                className="h-full rounded bg-emerald-600 transition-all"
                style={{ width: `${ytdIncome > 0 && ytdExpenses > 0 ? Math.min(100, Math.round((ytdIncome / Math.max(ytdIncome, ytdExpenses)) * 100)) : ytdIncome > 0 ? 100 : 0}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Expenses</span>
              <span className="text-red-400 tabular-nums">{money(ytdExpenses)}</span>
            </div>
            <div className="h-6 rounded bg-[#060B18] overflow-hidden">
              <div
                className="h-full rounded bg-red-600 transition-all"
                style={{ width: `${ytdExpenses > 0 ? Math.min(100, Math.round((ytdExpenses / Math.max(ytdIncome, ytdExpenses)) * 100)) : 0}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Net: {money(netOperatingIncome)} {netOperatingIncome >= 0 ? 'surplus' : 'deficit'}
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <div className="flex items-center justify-between border-b border-[#1E293B] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Transactions</h2>
            <p className="mt-0.5 text-xs text-slate-500">Latest financial activity across your associations</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
                <th className="px-5 py-3 text-left font-medium">Date</th>
                <th className="px-5 py-3 text-left font-medium">Description</th>
                <th className="px-5 py-3 text-left font-medium">Type</th>
                <th className="px-5 py-3 text-left font-medium">Association</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {recentTransactions.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No recent transactions available.</td></tr>
              ) : (
                recentTransactions.map((txn: any) => (
                  <tr key={txn.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-slate-400">{date(txn.created_at)}</td>
                    <td className="px-5 py-3 text-slate-300">{txn.description ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${
                        txn.type === 'credit' || txn.type === 'income'
                          ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 ring-red-500/20'
                      }`}>
                        {txn.type ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{txn.associations?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className={txn.type === 'credit' || txn.type === 'income' ? 'text-emerald-400' : 'text-red-400'}>
                        {money(txn.amount)}
                      </span>
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
