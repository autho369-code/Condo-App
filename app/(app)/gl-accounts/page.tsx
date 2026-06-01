import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

const RANGES: Array<{ from: number; to: number; label: string }> = [
  { from: 1000, to: 1999, label: 'Assets' },
  { from: 2000, to: 2999, label: 'Liabilities' },
  { from: 3000, to: 3999, label: 'Equity' },
  { from: 4000, to: 4999, label: 'Income' },
  { from: 5000, to: 5999, label: 'Cost of Goods Sold' },
  { from: 6000, to: 6999, label: 'Operating Expenses' },
  { from: 7000, to: 7999, label: 'Other Income' },
  { from: 8000, to: 8999, label: 'Other Expenses' },
  { from: 9000, to: 9999, label: 'Non-Operating' },
];

export default async function GLAccountsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('gl_accounts')
    .select('id, number, name, account_type, fund_account, include_on_cash_flow, subject_to_management_fees, active')
    .eq('active', true)
    .order('number');

  const grouped = RANGES.map((r) => ({
    ...r,
    items: (rows ?? []).filter((a: any) => a.number >= r.from && a.number <= r.to),
  })).filter((g) => g.items.length > 0);

  return (
    <ModulePage title="GL Accounts" description="Chart of accounts for the portfolio. Ranges follow standard accounting conventions.">
      {grouped.length === 0 ? (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-slate-400">No GL accounts configured yet.</p>
      ) : (
        grouped.map((g) => (
          <section key={g.label} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {g.from}s — {g.label} <span className="ml-1 font-normal text-gray-400">({g.items.length})</span>
            </h2>
            <Table>
              <THead><TR><TH>#</TH><TH>Name</TH><TH>Type</TH><TH>Fund</TH><TH>Flags</TH></TR></THead>
              <tbody>
                {g.items.map((a: any) => (
                  <TR key={a.id}>
                    <TD className="font-mono tabular-nums">{a.number}</TD>
                    <TD className="font-medium">{a.name}</TD>
                    <TD className="text-sm capitalize text-gray-700">{a.account_type?.replace(/_/g, ' ')}</TD>
                    <TD className="text-sm capitalize text-slate-400">{a.fund_account?.replace(/_/g, ' ') ?? '—'}</TD>
                    <TD className="text-xs text-slate-400">
                      {a.include_on_cash_flow && <span className="mr-1 rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">cash flow</span>}
                      {a.subject_to_management_fees && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-700">mgmt fee</span>}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </section>
        ))
      )}
    </ModulePage>
  );
}
