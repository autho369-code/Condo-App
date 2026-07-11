import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { money } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function BoardBudgetPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  if (ids.length === 0) {
    return (
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Budget vs Actual</h1>
        <p className="mt-4 text-sm text-gray-500">No association access. Contact your administrator.</p>
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

  const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Budget vs Actual</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Association financial performance against budget — FY{currentYear}</p>
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
            <h2 className="border-b border-gray-200 pb-2 text-[15px] font-semibold tracking-[-0.01em] text-gray-950">{report.associationName}</h2>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: `YTD Budget (thru ${MONTHS[currentMonth - 1]})`, value: money(ytdNetBudget), cls: 'text-gray-950' },
                { label: 'YTD Actual', value: money(ytdNetActual), cls: ytdNetActual >= ytdNetBudget ? 'text-emerald-700' : 'text-red-700' },
                { label: 'Variance', value: money(ytdNetActual - ytdNetBudget), cls: (ytdNetActual - ytdNetBudget) >= 0 ? 'text-emerald-700' : 'text-red-700' },
                { label: 'Variance %', value: ytdNetBudget !== 0 ? `${(((ytdNetActual - ytdNetBudget) / ytdNetBudget) * 100).toFixed(1)}%` : '—', cls: (ytdNetActual - ytdNetBudget) >= 0 ? 'text-emerald-700' : 'text-red-700' },
              ].map(s => (
                <div key={s.label} className={`${card} px-4 py-3.5`}>
                  <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.label}</div>
                  <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${s.cls}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* YTD Income vs Expense */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={`${card} p-4`}>
                <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">YTD Income</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Budget</span>
                    <span className="font-medium tabular-nums text-gray-950">{money(ytdIncomeBudget)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Actual</span>
                    <span className={`font-medium tabular-nums ${ytdIncomeActual >= ytdIncomeBudget ? 'text-emerald-700' : 'text-red-700'}`}>
                      {money(ytdIncomeActual)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${ytdIncomeBudget > 0 ? Math.min((ytdIncomeActual / ytdIncomeBudget) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className={`${card} p-4`}>
                <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">YTD Expenses</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Budget</span>
                    <span className="font-medium tabular-nums text-gray-950">{money(ytdExpenseBudget)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Actual</span>
                    <span className={`font-medium tabular-nums ${ytdExpenseActual <= ytdExpenseBudget ? 'text-emerald-700' : 'text-red-700'}`}>
                      {money(ytdExpenseActual)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${ytdExpenseActual <= ytdExpenseBudget ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${ytdExpenseBudget > 0 ? Math.min((ytdExpenseActual / ytdExpenseBudget) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Budget lines by GL account */}
            {rows.length > 0 ? (
              <div className={card}>
                <div className="border-b border-gray-100 px-5 py-3">
                  <h3 className="text-sm font-semibold text-gray-950">Budget by GL Account</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-5 py-2 font-medium">GL Account</th>
                        <th className="px-5 py-2 text-right font-medium">Budget</th>
                        <th className="px-5 py-2 text-right font-medium">Actual</th>
                        <th className="px-5 py-2 text-right font-medium">Variance</th>
                        <th className="px-5 py-2 text-right font-medium">%</th>
                        <th className="hidden px-5 py-2 font-medium sm:table-cell">Monthly Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row: any) => (
                        <tr key={row.budget_line_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full ${row.category === 'income' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              <span className="text-gray-900">{row.gl_account_number} — {row.gl_account_name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-gray-900">{money(row.annual_budget)}</td>
                          <td className={`px-5 py-2.5 text-right font-medium tabular-nums ${row.annual_actual >= row.annual_budget ? 'text-emerald-700' : 'text-red-700'}`}>
                            {money(row.annual_actual)}
                          </td>
                          <td className={`px-5 py-2.5 text-right tabular-nums ${row.annual_variance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {money(row.annual_variance)}
                          </td>
                          <td className={`px-5 py-2.5 text-right tabular-nums ${row.annual_variance_pct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {row.annual_variance_pct}%
                          </td>
                          <td className="hidden px-5 py-2.5 sm:table-cell">
                            <div className="flex h-8 items-end gap-0.5">
                              {(row.monthly_budget ?? []).map((budget: number, i: number) => {
                                const actual = (row.monthly_actuals ?? [])[i] ?? 0
                                const maxVal = Math.max(...(row.monthly_budget ?? []), ...(row.monthly_actuals ?? []), 1)
                                return (
                                  <div
                                    key={i}
                                    className={`flex-1 rounded-t-sm ${actual >= budget ? 'bg-emerald-500/40' : 'bg-red-500/40'}`}
                                    style={{ height: `${Math.max((Math.max(budget, actual) / maxVal) * 100, 2)}%` }}
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
              <div className={`${card} p-8 text-center`}>
                <BarChart3 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-semibold text-gray-900">No budget lines found for FY{currentYear}</p>
                <p className="mt-1 text-xs text-gray-500">Budget data will appear here once entered by management.</p>
              </div>
            )}

            {/* Management Fees Summary (historical tracking) */}
            {fees && fees.length > 0 && (
              <div className={card}>
                <div className="border-b border-gray-100 px-5 py-3">
                  <h3 className="text-sm font-semibold text-gray-950">Management Fee Collection History</h3>
                </div>
                <div className="p-5">
                  <div className="space-y-3">
                    {(fees ?? []).reverse().map((m: any) => {
                      const mn = new Date(m.month).getMonth()
                      // _cents columns are integer cents — convert to dollars
                      // before money() (which formats, but does not divide).
                      const budget = (m.fee_amount_cents ?? 0) / 100
                      const actual = (m.collected_cents ?? 0) / 100
                      const maxVal = Math.max(budget, actual, 1)
                      return (
                        <div key={m.month} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="w-12 font-medium text-gray-500">{MONTHS[mn]}</span>
                            <span className="w-24 text-right tabular-nums text-gray-900">{money(actual)}</span>
                            <span className="w-24 text-right tabular-nums text-gray-500">{money(budget)}</span>
                            <span className={`w-16 text-right text-xs tabular-nums ${actual >= budget ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {budget > 0 ? `${((actual - budget) / budget * 100).toFixed(0)}%` : '—'}
                            </span>
                          </div>
                          <div className="flex h-2 gap-0.5">
                            <div className="relative flex-1 overflow-hidden rounded-sm bg-gray-100">
                              <div className="absolute inset-y-0 left-0 rounded-sm bg-emerald-500/50" style={{ width: `${Math.min((actual / maxVal) * 100, 100)}%` }} />
                            </div>
                            <div className="w-0.5 rounded bg-gray-300" title="Budget target" />
                            <div className="relative flex-1 overflow-hidden rounded-sm bg-gray-100">
                              <div className="absolute inset-y-0 left-0 rounded-sm bg-gray-300" style={{ width: `${Math.min((budget / maxVal) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-6 pt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/50" /> Collected</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-gray-300" /> Budget</span>
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
