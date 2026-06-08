import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { money } from '@/lib/utils';
import { Plus, Pencil, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function BudgetPage({
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

  // Fetch GL accounts for the dropdown
  const { data: glAccounts } = await db
    .from('gl_accounts')
    .select('id, number, name, account_type')
    .order('number');

  // Fetch budget lines for selected association + year
  const { data: budgetLines } = selectedAssociation
    ? await db.rpc('list_budget_lines', {
        p_association_id: selectedAssociation,
        p_fiscal_year: selectedYear,
      })
    : { data: [] };

  const lines = (budgetLines ?? []) as any[];

  // Compute summary metrics
  const incomeLines = lines.filter((l: any) => l.category === 'income');
  const expenseLines = lines.filter((l: any) => l.category === 'expense');
  const totalIncomeBudget = incomeLines.reduce((s: number, l: any) => s + (l.annual_total ?? 0), 0);
  const totalExpenseBudget = expenseLines.reduce((s: number, l: any) => s + (l.annual_total ?? 0), 0);

  return (
    <div className="flex h-screen">
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Budget Management</h1>
              <p className="mt-1 text-sm text-slate-400">Per-association budget entries with monthly allocations</p>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Income Budget', value: money(totalIncomeBudget), icon: TrendingUp, cls: 'text-emerald-400' },
              { label: 'Expense Budget', value: money(totalExpenseBudget), icon: TrendingDown, cls: 'text-amber-400' },
              { label: 'Net Budget', value: money(totalIncomeBudget - totalExpenseBudget), icon: DollarSign, cls: 'text-white' },
              { label: 'Budget Lines', value: String(lines.length), icon: null, cls: 'text-white' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
                <div className="flex items-center gap-2">
                  {s.icon && <s.icon className={`h-4 w-4 ${s.cls}`} />}
                  <div className="text-xs font-medium uppercase text-slate-500">{s.label}</div>
                </div>
                <div className={`mt-1 text-2xl font-bold ${s.cls}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <form className="flex flex-wrap items-center gap-3">
            <select
              name="association"
              defaultValue={selectedAssociation}
              className="rounded-lg border border-[#1E293B] bg-[#0B1121] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              onChange={(e) => {
                (e.target.form as HTMLFormElement)?.requestSubmit();
              }}
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
              onChange={(e) => {
                (e.target.form as HTMLFormElement)?.requestSubmit();
              }}
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </form>

          {/* Budget lines table */}
          <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
            <div className="border-b border-[#1E293B] px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Budget Lines — {associations?.find((a: any) => a.id === selectedAssociation)?.name ?? 'No association selected'}
              </h2>
              {selectedAssociation && (
                <Link
                  href={`/budget/new?association=${selectedAssociation}&year=${selectedYear}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Budget Line
                </Link>
              )}
            </div>
            <div className="overflow-x-auto">
              {!selectedAssociation ? (
                <p className="py-12 text-center text-slate-500">Select an association above to view or manage budget lines.</p>
              ) : lines.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-slate-500">No budget lines found for {selectedYear}.</p>
                  <Link
                    href={`/budget/new?association=${selectedAssociation}&year=${selectedYear}`}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add your first budget line
                  </Link>
                </div>
              ) : (
                <>
                  {/* Income section */}
                  {incomeLines.length > 0 && (
                    <>
                      <div className="px-5 py-2 bg-emerald-500/5 border-b border-[#1E293B]">
                        <span className="text-xs font-semibold text-emerald-400 uppercase">Income</span>
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-[#1E293B]">
                          <tr className="text-xs font-medium text-slate-500">
                            <th className="px-5 py-2">GL Account</th>
                            <th className="px-5 py-2 text-right">Annual Total</th>
                            <th className="px-5 py-2 hidden sm:table-cell">Monthly Distribution</th>
                            <th className="px-5 py-2 hidden md:table-cell">Notes</th>
                            <th className="px-5 py-2 w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {incomeLines.map((line: any) => (
                            <BudgetRow key={line.id} line={line} association={selectedAssociation} year={selectedYear} />
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Expense section */}
                  {expenseLines.length > 0 && (
                    <>
                      <div className="px-5 py-2 bg-amber-500/5 border-b border-[#1E293B]">
                        <span className="text-xs font-semibold text-amber-400 uppercase">Expense</span>
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-[#1E293B]">
                          <tr className="text-xs font-medium text-slate-500">
                            <th className="px-5 py-2">GL Account</th>
                            <th className="px-5 py-2 text-right">Annual Total</th>
                            <th className="px-5 py-2 hidden sm:table-cell">Monthly Distribution</th>
                            <th className="px-5 py-2 hidden md:table-cell">Notes</th>
                            <th className="px-5 py-2 w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenseLines.map((line: any) => (
                            <BudgetRow key={line.id} line={line} association={selectedAssociation} year={selectedYear} />
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
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
                href={`/budget/new?association=${selectedAssociation}&year=${selectedYear}`}
                className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-[#1E293B] hover:text-white transition-colors"
              >
                + Add Budget Line
              </Link>
            )}
            <Link
              href={`/budget-vs-actuals${selectedAssociation ? `?association=${selectedAssociation}&year=${selectedYear}` : ''}`}
              className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-[#1E293B] hover:text-white transition-colors"
            >
              View Budget vs Actuals
            </Link>
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

function BudgetRow({ line, association, year }: { line: any; association: string; year: number }) {
  const monthlyTotal = line.annual_total ?? 0;
  const monthlyAmounts: number[] = line.monthly_amounts ?? [];

  return (
    <tr className="border-b border-[#1E293B] hover:bg-white/5 transition-colors">
      <td className="px-5 py-2.5">
        <div className="font-medium text-white">{line.gl_account_number} — {line.gl_account_name}</div>
      </td>
      <td className="px-5 py-2.5 text-right tabular-nums text-white font-medium">{money(monthlyTotal)}</td>
      <td className="px-5 py-2.5 hidden sm:table-cell">
        <div className="flex gap-0.5 items-end h-8">
          {monthlyAmounts.map((amt: number, i: number) => {
            const maxVal = Math.max(...monthlyAmounts, 1);
            const pct = (amt / maxVal) * 100;
            return (
              <div
                key={i}
                className="flex-1 rounded-t-sm"
                style={{
                  height: `${Math.max(pct, 2)}%`,
                  backgroundColor: line.category === 'income' ? 'rgba(16,185,129,0.4)' : 'rgba(251,191,36,0.4)',
                }}
                title={`${MONTHS[i]}: ${money(amt)}`}
              />
            );
          })}
        </div>
      </td>
      <td className="px-5 py-2.5 hidden md:table-cell text-slate-400 text-xs max-w-[200px] truncate">
        {line.notes || '—'}
      </td>
      <td className="px-5 py-2.5">
        <div className="flex items-center gap-1">
          <Link
            href={`/budget/${line.id}/edit?association=${association}&year=${year}`}
            className="p-1 rounded hover:bg-[#1E293B] text-slate-400 hover:text-white transition-colors"
            title="Edit / Delete"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        </div>
      </td>
    </tr>
  );
}
