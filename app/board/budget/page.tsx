import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { ExportActions, type ExportTable } from '@/components/export/export-actions'
import { money } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'
import { Alert } from '@/components/ui/shell'
import { fiscalMonthLabels, fiscalMonthsElapsed, fiscalYearFor } from '@/lib/budget/fiscal'

export const dynamic = 'force-dynamic'


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
      const { data: assoc } = await db
        .from('associations')
        .select('name, fiscal_year_start')
        .eq('id', assocId)
        .single()
      // Budgets follow each association's own fiscal year.
      const fy = fiscalYearFor(new Date(), assoc?.fiscal_year_start)
      const { data, error } = await db.rpc('get_budget_vs_actuals', {
        p_association_id: assocId,
        p_fiscal_year: fy,
      })
      return {
        associationId: assocId,
        associationName: assoc?.name ?? 'Association',
        rows: (error ? [] : data ?? []) as any[],
        error: error ? (error.message as string) : null,
        fy,
        labels: fiscalMonthLabels(assoc?.fiscal_year_start),
        elapsed: Math.max(1, fiscalMonthsElapsed(fy, assoc?.fiscal_year_start)),
      }
    })
  )

  const currentMonth = new Date().getMonth() + 1

  // ── Export setup: mirror the rendered tables with pre-rendered strings.
  const associationNames = allReports.map((r) => r.associationName).join(', ')
  const exportDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
  const exportTables: ExportTable[] = allReports
    .filter((report) => report.rows.length > 0)
    .map((report) => ({
      title: `${report.associationName} — Budget by GL Account (FY${report.fy})`,
      columns: [
        { header: 'GL Account' },
        { header: 'Category' },
        { header: 'Budget', align: 'right' as const },
        { header: 'Actual', align: 'right' as const },
        { header: 'Variance', align: 'right' as const },
        { header: 'Variance %', align: 'right' as const },
      ],
      rows: report.rows.map((row: any) => [
        `${row.gl_account_number} — ${row.gl_account_name}`,
        row.category ?? '—',
        money(row.annual_budget),
        money(row.annual_actual),
        money(row.annual_variance),
        `${row.annual_variance_pct}%`,
      ]),
    }))
  const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Budget vs Actual</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Association financial performance against budget — current fiscal year</p>
        </div>
        <ExportActions
          documentTitle={`Budget vs Actual — ${[...new Set(allReports.map((r) => `FY${r.fy}`))].join(', ') || `FY${currentYear}`}`}
          subtitle={associationNames || undefined}
          companyName={me.portfolio?.company_name ?? associationNames}
          filename={`budget-vs-actual-${exportDate}`}
          tables={exportTables}
        />
      </div>

      {/* Per-association reports */}
      {allReports.map((report) => {
        const rows = report.rows
        const incomeRows = rows.filter((r: any) => r.category === 'income')
        const expenseRows = rows.filter((r: any) => r.category === 'expense')

        const ytdIncomeBudget = incomeRows.reduce((s: number, r: any) => {
          return s + (r.monthly_budget ?? []).slice(0, report.elapsed).reduce((a: number, b: number) => a + (b ?? 0), 0)
        }, 0)
        const ytdIncomeActual = incomeRows.reduce((s: number, r: any) => {
          return s + (r.monthly_actuals ?? []).slice(0, report.elapsed).reduce((a: number, b: number) => a + (b ?? 0), 0)
        }, 0)
        const ytdExpenseBudget = expenseRows.reduce((s: number, r: any) => {
          return s + (r.monthly_budget ?? []).slice(0, report.elapsed).reduce((a: number, b: number) => a + (b ?? 0), 0)
        }, 0)
        const ytdExpenseActual = expenseRows.reduce((s: number, r: any) => {
          return s + (r.monthly_actuals ?? []).slice(0, report.elapsed).reduce((a: number, b: number) => a + (b ?? 0), 0)
        }, 0)

        const ytdNetBudget = ytdIncomeBudget - ytdExpenseBudget
        const ytdNetActual = ytdIncomeActual - ytdExpenseActual

        return (
          <div key={report.associationId} className="space-y-4">
            <h2 className="border-b border-gray-200 pb-2 text-[15px] font-semibold tracking-[-0.01em] text-gray-950">{report.associationName}</h2>
            {report.error && <Alert tone="danger" title="Budget vs actual could not be loaded">{report.error}</Alert>}

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: `YTD Budget (thru ${report.labels[report.elapsed - 1]})`, value: money(ytdNetBudget), cls: 'text-gray-950' },
                { label: 'YTD Actual', value: money(ytdNetActual), cls: ytdNetActual >= ytdNetBudget ? 'text-emerald-700' : 'text-red-700' },
                { label: 'Variance', value: money(ytdNetActual - ytdNetBudget), cls: (ytdNetActual - ytdNetBudget) >= 0 ? 'text-emerald-700' : 'text-red-700' },
                { label: 'Variance %', value: ytdNetBudget !== 0 ? `${(((ytdNetActual - ytdNetBudget) / ytdNetBudget) * 100).toFixed(1)}%` : '—', cls: (ytdNetActual - ytdNetBudget) >= 0 ? 'text-emerald-700' : 'text-red-700' },
              ].map(s => (
                <div key={s.label} className={`${card} px-4 py-3.5`}>
                  <div className="truncate text-[12.5px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.label}</div>
                  <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${s.cls}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* YTD Income vs Expense */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={`${card} p-4`}>
                <div className="mb-3 text-[12.5px] font-medium uppercase tracking-[0.08em] text-gray-400">YTD Income</div>
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
                <div className="mb-3 text-[12.5px] font-medium uppercase tracking-[0.08em] text-gray-400">YTD Expenses</div>
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
                    <thead className="border-b border-gray-100 bg-gray-50/60 text-[12.5px] uppercase tracking-wide text-gray-500">
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
                      {rows.map((row: any) => {
                        // Expense lines: spending over budget is bad, under is good.
                        const isExpense = row.category === 'expense'
                        const good = (actual: number, budget: number) => (isExpense ? actual <= budget : actual >= budget)
                        const varianceTone = (v: number) => ((isExpense ? v <= 0 : v >= 0) ? 'text-emerald-700' : 'text-red-700')
                        return (
                        <tr key={row.budget_line_id ?? row.gl_account_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full ${row.category === 'income' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              <span className="text-gray-900">{row.gl_account_number} — {row.gl_account_name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-gray-900">{money(row.annual_budget)}</td>
                          <td className={`px-5 py-2.5 text-right font-medium tabular-nums ${good(Number(row.annual_actual), Number(row.annual_budget)) ? 'text-emerald-700' : 'text-red-700'}`}>
                            {money(row.annual_actual)}
                          </td>
                          <td className={`px-5 py-2.5 text-right tabular-nums ${varianceTone(Number(row.annual_variance))}`}>
                            {money(row.annual_variance)}
                          </td>
                          <td className={`px-5 py-2.5 text-right tabular-nums ${varianceTone(Number(row.annual_variance_pct))}`}>
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
                                    className={`flex-1 rounded-t-sm ${good(actual, budget) ? 'bg-emerald-500/40' : 'bg-red-500/40'}`}
                                    style={{ height: `${Math.max((Math.max(budget, actual) / maxVal) * 100, 2)}%` }}
                                    title={`${report.labels[i]}: B ${money(budget)} / A ${money(actual)}`}
                                  />
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : report.error ? null : (
              <div className={`${card} p-8 text-center`}>
                <BarChart3 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-semibold text-gray-900">No budget lines found for FY{report.fy}</p>
                <p className="mt-1 text-xs text-gray-500">Budget data will appear here once entered by management.</p>
              </div>
            )}

          </div>
        )
      })}
    </div>
  )
}
