import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { money } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function BudgetVsActualsPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; year?: string }>;
}) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const { association, year } = await searchParams;
  const selectedYear = parseInt(year ?? String(new Date().getFullYear()), 10);

  // Fetch associations
  const { data: associations } = await db
    .from('associations')
    .select('id, name')
    .order('name');

  const selectedAssociation = association ?? associations?.[0]?.id ?? '';

  // Fetch budget vs actuals from RPC
  const { data: reportData } = selectedAssociation
    ? await db.rpc('get_budget_vs_actuals', {
        p_association_id: selectedAssociation,
        p_fiscal_year: selectedYear,
      })
    : { data: [] };

  const rows = (reportData ?? []) as any[];

  // Compute summary metrics
  const incomeRows = rows.filter((r: any) => r.category === 'income');
  const expenseRows = rows.filter((r: any) => r.category === 'expense');

  const totalIncomeBudget = incomeRows.reduce((s: number, r: any) => s + (r.annual_budget ?? 0), 0);
  const totalIncomeActual = incomeRows.reduce((s: number, r: any) => s + (r.annual_actual ?? 0), 0);
  const totalExpenseBudget = expenseRows.reduce((s: number, r: any) => s + (r.annual_budget ?? 0), 0);
  const totalExpenseActual = expenseRows.reduce((s: number, r: any) => s + (r.annual_actual ?? 0), 0);

  const netBudget = totalIncomeBudget - totalExpenseBudget;
  const netActual = totalIncomeActual - totalExpenseActual;
  const netVariance = netActual - netBudget;

  // YTD (use current month for partial-year)
  const currentMonth = selectedYear === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
  const ytdIncomeBudget = incomeRows.reduce((s: number, r: any) => {
    return s + (r.monthly_budget ?? []).slice(0, currentMonth).reduce((a: number, b: number) => a + (b ?? 0), 0);
  }, 0);
  const ytdIncomeActual = incomeRows.reduce((s: number, r: any) => {
    return s + (r.monthly_actuals ?? []).slice(0, currentMonth).reduce((a: number, b: number) => a + (b ?? 0), 0);
  }, 0);
  const ytdExpenseBudget = expenseRows.reduce((s: number, r: any) => {
    return s + (r.monthly_budget ?? []).slice(0, currentMonth).reduce((a: number, b: number) => a + (b ?? 0), 0);
  }, 0);
  const ytdExpenseActual = expenseRows.reduce((s: number, r: any) => {
    return s + (r.monthly_actuals ?? []).slice(0, currentMonth).reduce((a: number, b: number) => a + (b ?? 0), 0);
  }, 0);

  const ytdNetBudget = ytdIncomeBudget - ytdExpenseBudget;
  const ytdNetActual = ytdIncomeActual - ytdExpenseActual;

  return (
    <div className="flex h-screen">
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Budget vs Actuals</h1>
              <p className="mt-1 text-sm text-slate-400">Compare budgeted amounts against actual financial activity per GL account</p>
            </div>
            {selectedAssociation && (
              <Link
                href={`/budget?association=${selectedAssociation}&year=${selectedYear}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-sm text-slate-300 hover:bg-[#1E293B] hover:text-white transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                Manage Budget
              </Link>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label={`YTD Budget (thru ${MONTHS[currentMonth - 1]})`}
              value={money(ytdNetBudget)}
              icon={DollarSign}
              cls="text-white"
            />
            <SummaryCard
              label="YTD Actual"
              value={money(ytdNetActual)}
              icon={TrendingUp}
              cls={ytdNetActual >= ytdNetBudget ? 'text-emerald-400' : 'text-red-400'}
            />
            <SummaryCard
              label="YTD Variance"
              value={money(ytdNetActual - ytdNetBudget)}
              icon={Percent}
              cls={(ytdNetActual - ytdNetBudget) >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
            <SummaryCard
              label="Annual Budget"
              value={money(netBudget)}
              icon={DollarSign}
              cls="text-white"
            />
          </div>

          {/* YTD Income vs Expense summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
              <div className="text-xs font-medium uppercase text-slate-500 mb-3">YTD Income</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Budget</span>
                  <span className="text-white font-medium tabular-nums">{money(ytdIncomeBudget)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Actual</span>
                  <span className={`font-medium tabular-nums ${ytdIncomeActual >= ytdIncomeBudget ? 'text-emerald-400' : 'text-red-400'}`}>
                    {money(ytdIncomeActual)}
                  </span>
                </div>
                <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/50 rounded-full transition-all"
                    style={{ width: `${ytdIncomeBudget > 0 ? Math.min((ytdIncomeActual / ytdIncomeBudget) * 100, 100) : 0}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500">
                  {ytdIncomeBudget > 0 ? `${((ytdIncomeActual / ytdIncomeBudget) * 100).toFixed(1)}% of budget` : 'No budget set'}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
              <div className="text-xs font-medium uppercase text-slate-500 mb-3">YTD Expenses</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Budget</span>
                  <span className="text-white font-medium tabular-nums">{money(ytdExpenseBudget)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Actual</span>
                  <span className={`font-medium tabular-nums ${ytdExpenseActual <= ytdExpenseBudget ? 'text-emerald-400' : 'text-red-400'}`}>
                    {money(ytdExpenseActual)}
                  </span>
                </div>
                <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${ytdExpenseActual <= ytdExpenseBudget ? 'bg-emerald-500/50' : 'bg-red-500/50'}`}
                    style={{ width: `${ytdExpenseBudget > 0 ? Math.min((ytdExpenseActual / ytdExpenseBudget) * 100, 100) : 0}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500">
                  {ytdExpenseBudget > 0 ? `${((ytdExpenseActual / ytdExpenseBudget) * 100).toFixed(1)}% of budget` : 'No budget set'}
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <form className="flex flex-wrap items-center gap-3">
            <select
              name="association"
              defaultValue={selectedAssociation}
              className="rounded-lg border border-[#1E293B] bg-[#0B1121] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              onChange={(e) => { (e.target.form as HTMLFormElement)?.requestSubmit(); }}
            >
              <option value="">Select association...</option>
              {(associations ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              name="year"
              defaultValue={String(selectedYear)}
              className="rounded-lg border border-[#1E293B] bg-[#0B1121] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              onChange={(e) => { (e.target.form as HTMLFormElement)?.requestSubmit(); }}
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </form>

          {/* Report table */}
          <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
            <div className="border-b border-[#1E293B] px-5 py-3">
              <h2 className="text-sm font-semibold text-white">
                {associations?.find((a: any) => a.id === selectedAssociation)?.name ?? 'Select an association'} — FY{selectedYear}
              </h2>
            </div>
            <div className="overflow-x-auto">
              {!selectedAssociation ? (
                <p className="py-12 text-center text-slate-500">Select an association above to view the budget vs actuals report.</p>
              ) : rows.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-slate-500">No budget lines found for FY{selectedYear}.</p>
                  <Link
                    href={`/budget?association=${selectedAssociation}&year=${selectedYear}`}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
                  >
                    Set up budget lines first
                  </Link>
                </div>
              ) : (
                <>
                  {/* Income section */}
                  {incomeRows.length > 0 && (
                    <ReportSection
                      title="Income"
                      color="emerald"
                      rows={incomeRows}
                    />
                  )}

                  {/* Expense section */}
                  {expenseRows.length > 0 && (
                    <ReportSection
                      title="Expense"
                      color="amber"
                      rows={expenseRows}
                    />
                  )}

                  {/* Net summary row */}
                  <div className="border-t-2 border-[#1E293B] px-5 py-3 flex justify-between items-center bg-white/5">
                    <span className="text-sm font-bold text-white">Net Total</span>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Budget</div>
                        <div className="font-bold text-white tabular-nums">{money(netBudget)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Actual</div>
                        <div className={`font-bold tabular-nums ${netActual >= netBudget ? 'text-emerald-400' : 'text-red-400'}`}>
                          {money(netActual)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Variance</div>
                        <div className={`font-bold tabular-nums ${netVariance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {money(netVariance)}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TASK Panel */}
      <div className="hidden xl:block w-56 flex-shrink-0 border-l border-[#1E293B] p-4 space-y-5 overflow-auto" style={{ backgroundColor: '#0B1121' }}>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</h3>
          <div className="mt-3 space-y-1">
            {selectedAssociation && (
              <Link
                href={`/budget?association=${selectedAssociation}&year=${selectedYear}`}
                className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-[#1E293B] hover:text-white transition-colors"
              >
                Manage Budget Lines
              </Link>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">REPORT INFO</h3>
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            <p>Actuals are computed from:</p>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              <li><strong>Income:</strong> Charges posted to each GL account</li>
              <li><strong>Expenses:</strong> Paid/approved bills for each GL account</li>
            </ul>
            <p className="mt-2">Variance = Actual − Budget</p>
            <p>Positive variance = over budget (income) or under budget (expense)</p>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">FILTERS</h3>
          <p className="mt-2 text-xs text-slate-400">Use the dropdowns above to filter by association and fiscal year.</p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, cls }: { label: string; value: string; icon: any; cls: string }) {
  return (
    <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
      </div>
      <div className={`mt-1 text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function ReportSection({ title, color, rows }: { title: string; color: string; rows: any[] }) {
  const borderColor = color === 'emerald' ? 'border-emerald-500/30' : 'border-amber-500/30';
  const bgColor = color === 'emerald' ? 'bg-emerald-500/5' : 'bg-amber-500/5';
  const textColor = color === 'emerald' ? 'text-emerald-400' : 'text-amber-400';
  const barColor = color === 'emerald' ? 'rgba(16,185,129,0.4)' : 'rgba(251,191,36,0.4)';

  return (
    <>
      <div className={`px-5 py-2 ${bgColor} border-b ${borderColor}`}>
        <span className={`text-xs font-semibold uppercase ${textColor}`}>{title}</span>
      </div>
      {rows.map((row: any) => (
        <div key={row.budget_line_id} className="border-b border-[#1E293B]">
          {/* Summary row */}
          <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-white/5">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-white text-sm">
                {row.gl_account_number} — {row.gl_account_name}
              </div>
              {row.notes && <div className="text-xs text-slate-500 mt-0.5">{row.notes}</div>}
            </div>
            <div className="flex items-center gap-4 text-sm tabular-nums">
              <div className="text-right">
                <div className="text-xs text-slate-500">Budget</div>
                <div className="text-white font-medium">{money(row.annual_budget)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Actual</div>
                <div className={`font-medium ${row.annual_actual >= row.annual_budget ? 'text-emerald-400' : 'text-red-400'}`}>
                  {money(row.annual_actual)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Variance</div>
                <div className={`font-medium ${row.annual_variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {money(row.annual_variance)}
                </div>
              </div>
              <div className="text-right w-16">
                <div className="text-xs text-slate-500">%</div>
                <div className={`font-medium ${row.annual_variance_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.annual_variance_pct}%
                </div>
              </div>
            </div>
          </div>
          {/* Monthly bars */}
          <div className="px-5 pb-3">
            <div className="flex gap-0.5 items-end h-10">
              {(row.monthly_budget ?? []).map((budget: number, i: number) => {
                const actual = (row.monthly_actuals ?? [])[i] ?? 0;
                const maxVal = Math.max(...(row.monthly_budget ?? []), ...(row.monthly_actuals ?? []), 1);
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end gap-px" title={`${MONTHS[i]}: Budget ${money(budget)} / Actual ${money(actual)}`}>
                    {/* Budget bar (behind, semi-transparent) */}
                    <div className="w-full" style={{ height: `${Math.max((budget / maxVal) * 100, 1)}%` }}>
                      <div className="h-full rounded-t-sm bg-slate-500/20 w-full" />
                    </div>
                    {/* Actual bar (in front, thinner) */}
                    <div className="absolute w-[calc((100%/12)-2px)]" style={{ height: `${Math.max((actual / maxVal) * 100, 1)}%` }}>
                      <div className={`h-full rounded-t-sm w-full`} style={{ backgroundColor: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              {MONTHS.map((m) => (
                <span key={m} className="text-[9px] text-slate-600 flex-1 text-center">{m}</span>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-500/20 inline-block" /> Budget</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: barColor }} /> Actual</span>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
