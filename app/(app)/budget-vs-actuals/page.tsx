import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, roleHome } from '@/lib/auth/me';
import { redirect } from 'next/navigation';
import { money } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';
import { fiscalMonthLabels, fiscalMonthsElapsed, fiscalYearFor } from '@/lib/budget/fiscal';

export const dynamic = 'force-dynamic';


export default async function BudgetVsActualsPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; year?: string }>;
}) {
  // Finance-read surface: staff AND company admins (linked from the
  // company-admin Financials page).
  const me = await requireAuth();
  if (!me.is_staff && !me.is_company_admin && !me.is_platform_operator) redirect(roleHome(me));
  const supabase = await createClient();
  const db = supabase as any;
  const { association, year } = await searchParams;

  const { data: associations } = await db
    .from('associations')
    .select('id, name, fiscal_year_start')
    .order('name');

  const selectedAssociation = association ?? associations?.[0]?.id ?? '';
  const startMonth = associations?.find((a: any) => a.id === selectedAssociation)?.fiscal_year_start ?? 1;
  // Default to the fiscal year in progress for this association (FY N ends in year N).
  const parsedYear = parseInt(year ?? '', 10);
  const selectedYear = Number.isInteger(parsedYear) ? parsedYear : fiscalYearFor(new Date(), startMonth);

  const { data: reportData, error: reportError } = selectedAssociation
    ? await db.rpc('get_budget_vs_actuals', {
        p_association_id: selectedAssociation,
        p_fiscal_year: selectedYear,
      })
    : { data: [] };

  const rows = (reportData ?? []) as any[];

  const incomeRows = rows.filter((r: any) => r.category === 'income');
  const expenseRows = rows.filter((r: any) => r.category === 'expense');

  const totalIncomeBudget = incomeRows.reduce((s: number, r: any) => s + (r.annual_budget ?? 0), 0);
  const totalIncomeActual = incomeRows.reduce((s: number, r: any) => s + (r.annual_actual ?? 0), 0);
  const totalExpenseBudget = expenseRows.reduce((s: number, r: any) => s + (r.annual_budget ?? 0), 0);
  const totalExpenseActual = expenseRows.reduce((s: number, r: any) => s + (r.annual_actual ?? 0), 0);

  const netBudget = totalIncomeBudget - totalExpenseBudget;
  const netActual = totalIncomeActual - totalExpenseActual;
  const netVariance = netActual - netBudget;

  const MONTHS = fiscalMonthLabels(startMonth);
  // 0 for a fiscal year that has not started yet: YTD is then empty, not month 1.
  const currentMonth = fiscalMonthsElapsed(selectedYear, startMonth);
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
    <DataWorkspace
      title="Budget vs actuals"
      description="Compare budgeted amounts against actual financial activity per GL account. Actuals come from posted general-ledger entries, by month of the association’s fiscal year; variance = actual − budget."
      actions={
        selectedAssociation && (
          <Link href={`/budget?association=${selectedAssociation}&year=${selectedYear}`}>
            <Button variant="secondary"><BarChart3 className="h-4 w-4" /> Manage budget</Button>
          </Link>
        )
      }
    >
      <div className="space-y-6">
        {reportError && <Alert tone="danger">Budget vs actuals could not be loaded: {reportError.message}</Alert>}
        <MetricStrip
          metrics={[
            { label: currentMonth > 0 ? `YTD budget (thru ${MONTHS[currentMonth - 1]})` : 'YTD budget (not started)', value: money(ytdNetBudget) },
            {
              label: 'YTD actual',
              value: (
                <span className={ytdNetActual >= ytdNetBudget ? 'text-emerald-700' : 'text-red-700'}>
                  {money(ytdNetActual)}
                </span>
              ),
            },
            {
              label: 'YTD variance',
              value: (
                <span className={ytdNetActual - ytdNetBudget >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  {money(ytdNetActual - ytdNetBudget)}
                </span>
              ),
            },
            { label: 'Annual budget', value: money(netBudget) },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ProgressCard
            label="YTD income"
            budget={ytdIncomeBudget}
            actual={ytdIncomeActual}
            goodWhenAtLeast
          />
          <ProgressCard
            label="YTD expenses"
            budget={ytdExpenseBudget}
            actual={ytdExpenseActual}
          />
        </div>

        <Surface padded={false} className="p-3 sm:p-4">
          <form className="flex flex-wrap items-end gap-3">
            <label className="text-[12px] font-medium text-gray-500">
              Association
              <Select name="association" defaultValue={selectedAssociation} className="mt-1 min-w-56">
                <option value="">Select association…</option>
                {(associations ?? []).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </label>
            <label className="text-[12px] font-medium text-gray-500">
              Fiscal year
              <Select name="year" defaultValue={String(selectedYear)} className="mt-1 w-28">
                {[...new Set([2024, 2025, 2026, 2027, 2028, selectedYear])].sort((a, b) => a - b).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </label>
            <Button type="submit">Apply</Button>
          </form>
        </Surface>

        <Surface padded={false}>
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
              {associations?.find((a: any) => a.id === selectedAssociation)?.name ?? 'Select an association'} — FY{selectedYear}
            </h2>
          </div>
          <div className="overflow-x-auto">
            {!selectedAssociation ? (
              <EmptyState
                icon={BarChart3}
                title="No association selected"
                description="Select an association above to view the budget vs actuals report."
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title={`No budget or activity for FY${selectedYear}`}
                description="Set up budget lines first to compare them against actual activity."
                action={
                  <Link href={`/budget?association=${selectedAssociation}&year=${selectedYear}`}>
                    <Button variant="secondary">Set up budget lines</Button>
                  </Link>
                }
              />
            ) : (
              <>
                {incomeRows.length > 0 && <ReportSection months={MONTHS} title="Income" income rows={incomeRows} />}
                {expenseRows.length > 0 && <ReportSection months={MONTHS} title="Expense" rows={expenseRows} />}

                {/* Net summary row */}
                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/60 px-5 py-3">
                  <span className="text-sm font-semibold text-gray-950">Net total</span>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-[13px] text-gray-500">Budget</div>
                      <div className="font-semibold tabular-nums text-gray-950">{money(netBudget)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] text-gray-500">Actual</div>
                      <div className={`font-semibold tabular-nums ${netActual >= netBudget ? 'text-emerald-700' : 'text-red-700'}`}>
                        {money(netActual)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] text-gray-500">Variance</div>
                      <div className={`font-semibold tabular-nums ${netVariance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {money(netVariance)}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Surface>
      </div>
    </DataWorkspace>
  );
}

/** Budget-vs-actual progress card. For income, hitting budget is good; for expenses, staying under is good. */
function ProgressCard({
  label,
  budget,
  actual,
  goodWhenAtLeast = false,
}: {
  label: string;
  budget: number;
  actual: number;
  goodWhenAtLeast?: boolean;
}) {
  const onTrack = goodWhenAtLeast ? actual >= budget : actual <= budget;
  const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
  return (
    <Surface padded={false} className="p-4">
      <div className="mb-3 text-[13px] font-semibold text-gray-700">{label}</div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Budget</span>
          <span className="font-medium tabular-nums text-gray-950">{money(budget)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Actual</span>
          <span className={`font-medium tabular-nums ${onTrack ? 'text-emerald-700' : 'text-red-700'}`}>
            {money(actual)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${onTrack ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[13px] text-gray-500">
          {budget > 0 ? `${((actual / budget) * 100).toFixed(1)}% of budget` : 'No budget set'}
        </div>
      </div>
    </Surface>
  );
}

function ReportSection({ title, income = false, rows, months }: { title: string; income?: boolean; rows: any[]; months: string[] }) {
  const MONTHS = months;
  const barCls = income ? 'bg-emerald-500/40' : 'bg-amber-500/40';
  // variance = actual − budget. Over budget is good for income, bad for expenses.
  const favorable = (variance: number) => (income ? variance >= 0 : variance <= 0);
  const tone = (variance: number) => (favorable(variance) ? 'text-emerald-700' : 'text-red-700');

  return (
    <>
      <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-gray-500">{title}</span>
      </div>
      {rows.map((row: any) => (
        <div key={row.budget_line_id ?? row.gl_account_id} className="border-b border-gray-100 last:border-0">
          {/* Summary row */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50/60">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900">
                {row.gl_account_number} — {row.gl_account_name}
              </div>
              {row.budget_line_id == null
                ? <div className="mt-0.5 text-[13px] text-gray-500">Not budgeted — posted activity only</div>
                : row.notes && <div className="mt-0.5 text-[13px] text-gray-500">{row.notes}</div>}
            </div>
            <div className="flex items-center gap-4 text-sm tabular-nums">
              <div className="text-right">
                <div className="text-[13px] text-gray-500">Budget</div>
                <div className="font-medium text-gray-950">{money(row.annual_budget)}</div>
              </div>
              <div className="text-right">
                <div className="text-[13px] text-gray-500">Actual</div>
                <div className={`font-medium ${tone(row.annual_actual - row.annual_budget)}`}>
                  {money(row.annual_actual)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[13px] text-gray-500">Variance</div>
                <div className={`font-medium ${tone(row.annual_variance)}`}>
                  {money(row.annual_variance)}
                </div>
              </div>
              <div className="w-16 text-right">
                <div className="text-[13px] text-gray-500">%</div>
                <div className={`font-medium ${tone(row.annual_variance_pct)}`}>
                  {row.annual_variance_pct}%
                </div>
              </div>
            </div>
          </div>
          {/* Monthly bars */}
          <div className="px-5 pb-3">
            <div className="flex h-10 items-end gap-0.5">
              {(row.monthly_budget ?? []).map((budget: number, i: number) => {
                const actual = (row.monthly_actuals ?? [])[i] ?? 0;
                const maxVal = Math.max(...(row.monthly_budget ?? []), ...(row.monthly_actuals ?? []), 1);
                return (
                  <div
                    key={i}
                    className="flex flex-1 items-end gap-px"
                    title={`${MONTHS[i]}: Budget ${money(budget)} / Actual ${money(actual)}`}
                  >
                    <div className="w-1/2 rounded-t-sm bg-gray-200" style={{ height: `${Math.max((budget / maxVal) * 100, 2)}%` }} />
                    <div className={`w-1/2 rounded-t-sm ${barCls}`} style={{ height: `${Math.max((actual / maxVal) * 100, 2)}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between">
              {MONTHS.map((m) => (
                <span key={m} className="flex-1 text-center text-[11.5px] text-gray-400">{m}</span>
              ))}
            </div>
            {/* Legend */}
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-gray-200" /> Budget</span>
              <span className="flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded-sm ${barCls}`} /> Actual</span>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
