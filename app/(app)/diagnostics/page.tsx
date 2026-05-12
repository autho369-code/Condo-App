import { AccountingPage } from '@/components/accounting/accounting-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DiagnosticsPage() {
  const me = await requireStaff();
  const supabase = await createClient();

  const [{ count: missingPhone }, { count: missingEmail }, { data: summary }] = await Promise.all([
    (supabase as any).from('owners').select('*', { count: 'exact', head: true }).or('phone.is.null,phone.eq.'),
    (supabase as any).from('owners').select('*', { count: 'exact', head: true }).or('email.is.null,email.eq.'),
    (supabase as any)
      .from('v_dashboard_summary')
      .select('open_diagnostics, portal_not_activated_count, insurance_expirations_60d')
      .eq('portfolio_id', me.portfolio?.id ?? '00000000-0000-0000-0000-000000000000')
      .maybeSingle(),
  ]);

  const sections = [
    { name: 'Security Deposit Funds Mismatch', rows: [] },
    { name: 'Escrow Cash Account Balance Mismatch', rows: [] },
    { name: 'Non-Zero Security Clearing Account Balances', rows: [] },
    { name: 'Negative Balance on Additional Fee GL Accounts', rows: [] },
    { name: 'Positive Balance on Additional Fee GL Accounts', rows: [] },
    {
      name: 'Tenants and Homeowners With Unused Prepayments / Open Charges / Open Credits',
      rows: [
        { label: 'Owners missing phone', value: missingPhone ?? 0 },
        { label: 'Owners missing email', value: missingEmail ?? 0 },
        { label: 'Portal not activated', value: summary?.portal_not_activated_count ?? 0 },
      ],
    },
    { name: 'Prepayment Balance Mismatch', rows: [] },
    {
      name: 'Bank Account Reconciliation Lapses Over 60 Days',
      rows: [
        { label: 'Insurance expiring within 60 days', value: summary?.insurance_expirations_60d ?? 0 },
        { label: 'Other diagnostics', value: summary?.open_diagnostics ?? 0 },
      ],
    },
  ];

  return (
    <AccountingPage active="diagnostics" title="Financial Diagnostics">
      <div className="space-y-4">
        <form action="/diagnostics" className="border border-brand-500 bg-white px-8 py-5">
          <div className="grid gap-3 text-xs md:grid-cols-[140px_1fr]">
            <label htmlFor="association" className="self-center text-right text-ink-700">Association</label>
            <input id="association" name="association" placeholder="Search by property, group, portfolio, or owner" className="h-8 border border-ink-300 px-2 text-xs" />
            <span />
            <select name="scope" className="h-8 border border-ink-300 bg-white px-2 text-xs">
              <option>Show All Associations</option>
              <option>Show Active Associations</option>
            </select>
            <span />
            <button type="submit" className="h-8 w-fit bg-brand-700 px-4 text-xs font-medium text-white">Search</button>
          </div>
        </form>

        <div className="text-right">
          <button type="button" className="border border-ink-300 bg-white px-3 py-1.5 text-xs text-ink-800">Print</button>
        </div>

        <div className="space-y-3">
          {sections.map((section) => (
            <section key={section.name}>
              <h2 className="border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-900">{section.name}</h2>
              <Table>
                <THead><TR><TH>Association</TH><TH className="text-right">Balance</TH></TR></THead>
                <tbody>
                  {section.rows.length > 0 ? (
                    section.rows.map((row) => (
                      <TR key={row.label}>
                        <TD>{row.label}</TD>
                        <TD className="text-right tabular-nums">{row.value}</TD>
                      </TR>
                    ))
                  ) : (
                    <TR><TD colSpan={2} className="text-center text-sm text-ink-500">No mismatched balance</TD></TR>
                  )}
                </tbody>
              </Table>
            </section>
          ))}
        </div>
      </div>
    </AccountingPage>
  );
}
