import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { money } from '@/lib/utils'
import { TrendingUp, BarChart3, DollarSign } from 'lucide-react'

export const dynamic = 'force-dynamic'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function BoardBudgetPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  if (ids.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white">Budget vs Actual</h1>
        <p className="mt-4 text-slate-400">No association access. Contact your administrator.</p>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()

  // Fetch budget vs actuals for each association
  const allReports = await Promise.all(
    ids.map(async (assocId: string) => {
      const { data } = await db.rpc('get_budget_vs_actuals', {
        p_association_id: assocId,
        p_fiscal_year: currentYear,
      })
      // Fetch association name
      const { data: assoc } = await db
        .from('associations')
        .select('name')
        .eq('id', assocId)
        .single()
      return { associationId: assocId, associationName: assoc?.name ?? 'Association', rows: (data ?? []) as any[] }
    })
  )

  // Also try management_fees as fallback for income tracking
  const { data: fees } = await db
    .from('management_fees')
    .select('month, fee_amount_cents, collected_cents, delinquent_cents')
    .in('association_id', ids)
    .order('month', { ascending: false })
    .limit(12)

  const currentMonth = new Date().getMonth() + 1

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Budget vs Actual</h1>
        <p className="mt-1 text-sm text-slate-400">Association financial performance against budget — FY{currentYear}</p>
      </div>

      {/* Per-association reports */}
      {allReports.map((report) => {
        const rows = report.rows
        const incomeRows = rows.filter((r: any) => r.category === 'income')
        const expenseRows = rows.filter((r: any) => r.category === 'expense')

        const ytdIncomeBudget = incomeRows.reduce((s: number, r: any) => {
          return s + (r.monthly_budget ?? []).slice(0, currentMonth).reduce((a: number, b: number) => a + (b ?? 0), 0)
        }, 0)
        const ytdIncomeActual = incomeRows.reduce((s: number, r: any) => {
          return s + (r.monthly_actuals ?? []).slice(0, currentMonth).reduce((a: number, b: number) => a + (b ?? 0), 0)
        }, 0)
        const ytdExpenseBudget = expenseRows.reduce((s: number, r: any) => {
          return s + (r.monthly_budget ?? []).slice(0, currentMonth).reduce((a: number, b: number) => a + (b ?? 0), 0)
        }, 0)
        const ytdExpenseActual = expenseRows.reduce((s: number, r: any) => {
          return s + (r.monthly_actuals ?? []).slice(0, currentMonth).reduce((a: number, b: number) => a + (b ?? 0), 0)
        }, 0)

        const ytdNetBudget = ytdIncomeBudget - ytdExpenseBudget
        const ytdNetActual = ytdIncomeActual - ytdExpenseActual

        return (
          <div key={report.associationId} className="space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400 border-b border-[#1E293B] pb-2">{report.associationName}</h2>

            {/* Summary cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: `YTD Budget (thru ${MONTHS[currentMonth - 1]})`, value: money(ytdNetBudget), cls: 'text-white' },
                { label: 'YTD Actual', value: money(ytdNetActual), cls: ytdNetActual >= ytdNetBudget ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Variance', value: money(ytdNetActual - ytdNetBudget), cls: (ytdNetActual - ytdNetBudget) >= 0 ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Variance %', value: ytdNetBudget !== 0 ? `${(((ytdNetActual - ytdNetBudget) / ytdNetBudget) * 100).toFixed(1)}%` : '—', cls: (ytdNetActual - ytdNetBudget) >= 0 ? 'text-emerald-400' : 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
                  <div className="text-xs font-medium uppercase text-slate-500">{s.label}</div>
                  <div className={`mt-1 text-2xl font-bold ${s.cls}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* YTD Income vs Expense */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
                <div className="text-xs font-medium uppercase text-slate-500 mb-3">YTD Income</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Budget</span>
                    <span className="text-white font-medium">{money(ytdIncomeBudget)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Actual</span>
                    <span className={ytdIncomeActual >= ytdIncomeBudget ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                      {money(ytdIncomeActual)}
                    </span>
                  </div>
                  <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/50 rounded-full"
                      style={{ width: `${ytdIncomeBudget > 0 ? Math.min((ytdIncomeActual / ytdIncomeBudget) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
                <div className="text-xs font-medium uppercase text-slate-500 mb-3">YTD Expenses</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Budget</span>
                    <span className="text-white font-medium">{money(ytdExpenseBudget)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Actual</span>
                    <span className={ytdExpenseActual <= ytdExpenseBudget ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                      {money(ytdExpenseActual)}
                    </span>
                  </div>
                  <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ytdExpenseActual <= ytdExpenseBudget ? 'bg-emerald-500/50' : 'bg-red-500/50'}`}
                      style={{ width: `${ytdExpenseBudget > 0 ? Math.min((ytdExpenseActual / ytdExpenseBudget) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Budget lines by GL account */}
            {rows.length > 0 ? (
              <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
                <div className="border-b border-[#1E293B] px-5 py-3">
                  <h3 className="text-sm font-semibold text-white">Budget by GL Account</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#1E293B]">
                      <tr className="text-xs font-medium text-slate-500">
                        <th className="px-5 py-2">GL Account</th>
                        <th className="px-5 py-2 text-right">Budget</th>
                        <th className="px-5 py-2 text-right">Actual</th>
                        <th className="px-5 py-2 text-right">Variance</th>
                        <th className="px-5 py-2 text-right">%</th>
                        <th className="px-5 py-2 hidden sm:table-cell">Monthly Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row: any) => (
                        <tr key={row.budget_line_id} className="border-b border-[#1E293B] hover:bg-white/5">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${row.category === 'income' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                              <span className="text-white">{row.gl_account_number} — {row.gl_account_name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-white">{money(row.annual_budget)}</td>
                          <td className={`px-5 py-2.5 text-right tabular-nums font-medium ${row.annual_actual >= row.annual_budget ? 'text-emerald-400' : 'text-red-400'}`}>
                            {money(row.annual_actual)}
                          </td>
                          <td className={`px-5 py-2.5 text-right tabular-nums ${row.annual_variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {money(row.annual_variance)}
                          </td>
                          <td className={`px-5 py-2.5 text-right tabular-nums ${row.annual_variance_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {row.annual_variance_pct}%
                          </td>
                          <td className="px-5 py-2.5 hidden sm:table-cell">
                            <div className="flex gap-0.5 items-end h-8">
                              {(row.monthly_budget ?? []).map((budget: number, i: number) => {
                                const actual = (row.monthly_actuals ?? [])[i] ?? 0
                                const maxVal = Math.max(...(row.monthly_budget ?? []), ...(row.monthly_actuals ?? []), 1)
                                return (
                                  <div
                                    key={i}
                                    className="flex-1 rounded-t-sm"
                                    style={{
                                      height: `${Math.max((Math.max(budget, actual) / maxVal) * 100, 2)}%`,
                                      backgroundColor: actual >= budget
                                        ? 'rgba(16,185,129,0.5)'
                                        : 'rgba(239,68,68,0.5)',
                                    }}
                                    title={`${MONTHS[i]}: B ${money(budget)} / A ${money(actual)}`}
                                  />
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#1E293B] p-8 text-center" style={{ backgroundColor: '#0B1121' }}>
                <BarChart3 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">No budget lines found for FY{currentYear}.</p>
                <p className="text-xs text-slate-600 mt-1">Budget data will appear here once entered by management.</p>
              </div>
            )}

            {/* Management Fees Summary (historical tracking) */}
            {fees && fees.length > 0 && (
              <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
                <div className="border-b border-[#1E293B] px-5 py-3">
                  <h3 className="text-sm font-semibold text-white">Management Fee Collection History</h3>
                </div>
                <div className="p-5">
                  <div className="space-y-3">
                    {(fees ?? []).reverse().map((m: any) => {
                      const mn = new Date(m.month).getMonth()
                      const budget = m.fee_amount_cents ?? 0
                      const actual = m.collected_cents ?? 0
                      const maxVal = Math.max(budget, actual, 1)
                      return (
                        <div key={m.month} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400 font-medium w-12">{MONTHS[mn]}</span>
                            <span className="text-slate-300 tabular-nums w-24 text-right">{money(actual)}</span>
                            <span className="text-slate-500 tabular-nums w-24 text-right">{money(budget)}</span>
                            <span className={`tabular-nums w-16 text-right text-xs ${actual >= budget ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {budget > 0 ? `${((actual - budget) / budget * 100).toFixed(0)}%` : '—'}
                            </span>
                          </div>
                          <div className="flex h-2 gap-0.5">
                            <div className="bg-[#1E293B] rounded-sm flex-1 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-emerald-500/30 rounded-sm" style={{ width: `${Math.min((actual / maxVal) * 100, 100)}%` }} />
                            </div>
                            <div className="w-0.5 bg-slate-600 rounded" title="Budget target" />
                            <div className="bg-[#1E293B] rounded-sm flex-1 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-slate-500/20 rounded-sm" style={{ width: `${Math.min((budget / maxVal) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-6 pt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/30 inline-block" /> Collected</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-500/20 inline-block" /> Budget</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
