import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

type BudgetRow = {
  acct: any;
  monthly: number[];
  prior: number;
};

export default async function BudgetTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fiscal_year?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const fiscalYear = Number(sp.fiscal_year ?? new Date().getFullYear());

  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations').select('id, name, address').eq('id', id).maybeSingle();
  if (aErr || !assoc) notFound();

  const { data: accounts } = await (supabase as any)
    .from('gl_accounts')
    .select('id, number, name, account_type')
    .or(`association_id.eq.${id},association_id.is.null`)
    .eq('active', true)
    .order('number');

  const { data: lines } = await (supabase as any)
    .from('budget_lines')
    .select('gl_account_id, fiscal_year, monthly_amounts, category')
    .eq('association_id', id)
    .eq('fiscal_year', fiscalYear);

  const { data: priorActuals } = await (supabase as any)
    .from('budget_line_totals')
    .select('gl_account_id, annual_total')
    .eq('association_id', id)
    .eq('fiscal_year', fiscalYear - 1);

  const lineByAccount = new Map<string, any>();
  (lines ?? []).forEach((l: any) => lineByAccount.set(l.gl_account_id, l));

  const priorByAccount = new Map<string, number>();
  (priorActuals ?? []).forEach((p: any) => priorByAccount.set(p.gl_account_id, Number(p.annual_total)));

  const incomeAccounts = (accounts ?? []).filter((a: any) => a.account_type === 'income');
  const expenseAccounts = (accounts ?? []).filter((a: any) => a.account_type === 'expense');

  const sumLine = (acctId: string): number[] => {
    const l = lineByAccount.get(acctId);
    if (!l?.monthly_amounts) return Array(12).fill(0);
    return (l.monthly_amounts as any[]).map((n) => Number(n) || 0);
  };

  const incomeRows: BudgetRow[] = incomeAccounts.map((a: any) => ({ acct: a, monthly: sumLine(a.id), prior: priorByAccount.get(a.id) ?? 0 }));
  const expenseRows: BudgetRow[] = expenseAccounts.map((a: any) => ({ acct: a, monthly: sumLine(a.id), prior: priorByAccount.get(a.id) ?? 0 }));

  const incomeAnnualBudget = incomeRows.reduce((s, r) => s + r.monthly.reduce((x, y) => x + y, 0), 0);
  const incomeAnnualPrior  = incomeRows.reduce((s, r) => s + r.prior, 0);
  const expenseAnnualBudget = expenseRows.reduce((s, r) => s + r.monthly.reduce((x, y) => x + y, 0), 0);
  const expenseAnnualPrior  = expenseRows.reduce((s, r) => s + r.prior, 0);

  const totalRows = incomeRows.length + expenseRows.length + 2;

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="budget" />
          <WorkspaceHeader
            title="Budget"
            subtitle={`${assoc.name}${assoc.address ? ` — ${assoc.address}` : ''}`}
          />
        </>
      }
      rail={rail}
    >
      <Section>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 1100 }}>
            <thead className="border-b border-ink-100 bg-cream-50 text-xs uppercase tracking-wide text-ink-600">
              <tr>
                <th className="min-w-[220px] px-3 py-2 text-left font-semibold">GL Account</th>
                <th className="min-w-[150px] px-3 py-2 text-left font-semibold">Calculation Method</th>
                <th className="px-3 py-2 text-right font-semibold">{fiscalYear - 1} Actuals ($)</th>
                <th className="px-3 py-2 text-right font-semibold">{fiscalYear} Budget ($)</th>
                {MONTHS.map((m) => <th key={m} className="px-3 py-2 text-right font-semibold">{m} ($)</th>)}
              </tr>
            </thead>
            <tbody>
              <ParentRow label="INCOME" annualPrior={incomeAnnualPrior} annualBudget={incomeAnnualBudget} months={sumColumns(incomeRows.map((r) => r.monthly))} />
              {incomeRows.map((r: any) => <ChildRow key={r.acct.id} acct={r.acct} prior={r.prior} monthly={r.monthly} />)}
              <ParentRow label="EXPENSE" annualPrior={expenseAnnualPrior} annualBudget={expenseAnnualBudget} months={sumColumns(expenseRows.map((r) => r.monthly))} />
              {expenseRows.map((r: any) => <ChildRow key={r.acct.id} acct={r.acct} prior={r.prior} monthly={r.monthly} />)}
              {totalRows === 2 && (
                <tr><td colSpan={16} className="px-4 py-8 text-center text-sm italic text-ink-500">No GL accounts configured for this association.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="mt-3 text-sm text-ink-600">
        Displaying: <span className="tabular-nums">{totalRows}</span> of <span className="tabular-nums">{totalRows}</span>
      </div>
    </Workspace>
  );
}

function sumColumns(rows: number[][]): number[] {
  const out = Array(12).fill(0);
  for (const r of rows) for (let i = 0; i < 12; i++) out[i] += r[i] ?? 0;
  return out;
}

function fmt(n: number): string {
  if (!n) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ParentRow({ label, annualPrior, annualBudget, months }: { label: string; annualPrior: number; annualBudget: number; months: number[]; }) {
  return (
    <tr className="border-b border-ink-100 bg-cream-50 font-semibold">
      <td className="px-3 py-2 text-ink-900"><span className="mr-1 text-ink-400">▾</span>{label}</td>
      <td className="px-3 py-2"></td>
      <td className="px-3 py-2 text-right tabular-nums text-ink-900">{fmt(annualPrior)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-ink-900">{fmt(annualBudget)}</td>
      {months.map((m, i) => <td key={i} className="px-3 py-2 text-right tabular-nums text-ink-900">{fmt(m)}</td>)}
    </tr>
  );
}

function ChildRow({ acct, prior, monthly }: { acct: { id: string; number: number | null; name: string }; prior: number; monthly: number[]; }) {
  const annualBudget = monthly.reduce((s, n) => s + n, 0);
  const code = acct.number != null ? `${acct.number}: ${truncate(acct.name, 20)}` : truncate(acct.name, 22);
  return (
    <tr className="border-b border-ink-100 last:border-b-0">
      <td className="px-3 py-2 pl-8 text-ink-700">{code}</td>
      <td className="px-3 py-2"><span className="text-xs italic text-ink-400">—</span></td>
      <td className="px-3 py-2 text-right tabular-nums text-ink-700">{fmt(prior)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-ink-700">{fmt(annualBudget)}</td>
      {monthly.map((m, i) => <td key={i} className="px-3 py-2 text-right tabular-nums text-ink-700">{fmt(m)}</td>)}
    </tr>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
