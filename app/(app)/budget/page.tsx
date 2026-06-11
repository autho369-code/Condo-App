import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { money } from '@/lib/utils';
import { Plus, Pencil, PiggyBank } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; year?: string }>;
}) {
  let error: string | null = null;
  let associations: any[] = [];
  let lines: any[] = [];
  let selectedYear = new Date().getFullYear();
  let selectedAssociation = '';

  try {
    await requireStaff();
    const supabase = await createClient();
    const db = supabase as any;
    const params = await searchParams;
    const { association } = params;
    const year = params.year;
    selectedYear = parseInt(year ?? String(new Date().getFullYear()), 10);

    const assocResult = await db.from('associations').select('id, name').order('name');
    if (assocResult.error) throw new Error('associations: ' + assocResult.error.message);
    associations = assocResult.data ?? [];

    selectedAssociation = association ?? associations?.[0]?.id ?? '';

    if (selectedAssociation) {
      const blResult = await db.rpc('list_budget_lines', {
        p_association_id: selectedAssociation,
        p_fiscal_year: selectedYear,
      });
      if (blResult.error) throw new Error('list_budget_lines: ' + blResult.error.message);
      lines = blResult.data ?? [];
    }
  } catch (e: any) {
    error = e.message || String(e);
  }

  if (!selectedAssociation && associations.length > 0) {
    selectedAssociation = associations[0].id;
  }
  const incomeLines = lines.filter((l: any) => l.category === 'income');
  const expenseLines = lines.filter((l: any) => l.category === 'expense');
  const totalIncomeBudget = incomeLines.reduce((s: number, l: any) => s + (l.annual_total ?? 0), 0);
  const totalExpenseBudget = expenseLines.reduce((s: number, l: any) => s + (l.annual_total ?? 0), 0);
  const selectedName = associations?.find((a: any) => a.id === selectedAssociation)?.name;

  return (
    <DataWorkspace
      title="Budget management"
      description="Per-association budget entries with monthly allocations."
      actions={
        selectedAssociation && (
          <Link href={`/budget/new?association=${selectedAssociation}&year=${selectedYear}`}>
            <Button><Plus className="h-4 w-4" /> Add budget line</Button>
          </Link>
        )
      }
    >
      <div className="space-y-6">
        {error && <Alert tone="danger" title="Error:">{error}</Alert>}

        <MetricStrip
          metrics={[
            { label: 'Income budget', value: money(totalIncomeBudget) },
            { label: 'Expense budget', value: money(totalExpenseBudget) },
            { label: 'Net budget', value: money(totalIncomeBudget - totalExpenseBudget) },
            {
              label: 'Budget lines',
              value: lines.length,
              sublabel: (
                <Link
                  href={`/budget-vs-actuals${selectedAssociation ? `?association=${selectedAssociation}&year=${selectedYear}` : ''}`}
                  className="font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                  Budget vs actuals
                </Link>
              ),
            },
          ]}
        />

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
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </label>
            <Button type="submit">Apply</Button>
          </form>
        </Surface>

        <Surface padded={false}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-950">
              Budget lines — {selectedName ?? 'No association selected'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            {!selectedAssociation ? (
              <EmptyState
                icon={PiggyBank}
                title="No association selected"
                description="Select an association above to view or manage budget lines."
              />
            ) : lines.length === 0 ? (
              <EmptyState
                icon={PiggyBank}
                title={`No budget lines for ${selectedYear}`}
                description="Add your first budget line to start planning this fiscal year."
                action={
                  <Link href={`/budget/new?association=${selectedAssociation}&year=${selectedYear}`}>
                    <Button><Plus className="h-4 w-4" /> Add budget line</Button>
                  </Link>
                }
              />
            ) : (
              <>
                {incomeLines.length > 0 && (
                  <BudgetSection
                    title="Income"
                    lines={incomeLines}
                    association={selectedAssociation}
                    year={selectedYear}
                  />
                )}
                {expenseLines.length > 0 && (
                  <BudgetSection
                    title="Expense"
                    lines={expenseLines}
                    association={selectedAssociation}
                    year={selectedYear}
                  />
                )}
              </>
            )}
          </div>
        </Surface>
      </div>
    </DataWorkspace>
  );
}

function BudgetSection({
  title,
  lines,
  association,
  year,
}: {
  title: 'Income' | 'Expense';
  lines: any[];
  association: string;
  year: number;
}) {
  return (
    <>
      <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</span>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-5 py-2 font-medium">GL account</th>
            <th className="px-5 py-2 text-right font-medium">Annual total</th>
            <th className="hidden px-5 py-2 font-medium sm:table-cell">Monthly distribution</th>
            <th className="hidden px-5 py-2 font-medium md:table-cell">Notes</th>
            <th className="w-20 px-5 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line: any) => (
            <BudgetRow key={line.id} line={line} association={association} year={year} />
          ))}
        </tbody>
      </table>
    </>
  );
}

function BudgetRow({ line, association, year }: { line: any; association: string; year: number }) {
  const monthlyTotal = line.annual_total ?? 0;
  const monthlyAmounts: number[] = line.monthly_amounts ?? [];

  return (
    <tr className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/60">
      <td className="px-5 py-2.5">
        <div className="font-medium text-gray-900">{line.gl_account_number} — {line.gl_account_name}</div>
      </td>
      <td className="px-5 py-2.5 text-right font-medium tabular-nums text-gray-950">{money(monthlyTotal)}</td>
      <td className="hidden px-5 py-2.5 sm:table-cell">
        <div className="flex h-8 items-end gap-0.5">
          {monthlyAmounts.map((amt: number, i: number) => {
            const maxVal = Math.max(...monthlyAmounts, 1);
            const pct = (amt / maxVal) * 100;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t-sm ${line.category === 'income' ? 'bg-emerald-500/40' : 'bg-amber-500/40'}`}
                style={{ height: `${Math.max(pct, 2)}%` }}
                title={`${MONTHS[i]}: ${money(amt)}`}
              />
            );
          })}
        </div>
      </td>
      <td className="hidden max-w-[200px] truncate px-5 py-2.5 text-xs text-gray-500 md:table-cell">
        {line.notes || '—'}
      </td>
      <td className="px-5 py-2.5">
        <Link
          href={`/budget/${line.id}/edit?association=${association}&year=${year}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="Edit / Delete"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  );
}
