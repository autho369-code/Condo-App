import Link from 'next/link';
import { BookOpen, Download, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { hasPortfolioAdminAccess, requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert, EmptyState, SectionTitle } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { glBalances, normalBalance } from '@/lib/gl/accounts';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Grouped by the account's type (what the reports use). Grouping by number
// range filed e.g. a 5xxx expense under Cost of Goods Sold and a 7xxx
// reserve expense under Other Income, and hid numbers outside 1000-9999.
const GROUPS: Array<{ label: string; types: string[] }> = [
  { label: 'Assets', types: ['cash', 'asset', 'accounts_receivable', 'fixed_asset'] },
  { label: 'Liabilities', types: ['liability', 'accounts_payable'] },
  { label: 'Equity', types: ['equity'] },
  { label: 'Income', types: ['income', 'other_income'] },
  { label: 'Expenses', types: ['expense', 'cost_of_goods_sold', 'other_expense', 'non_operating'] },
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GLAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; association_id?: string; saved?: string; created?: string }>;
}) {
  const me = await requireStaff();
  const { q = '', status = '', association_id = '', saved = '', created = '' } = await searchParams;
  const isFinance = me.is_finance_staff || me.is_platform_operator;
  const assoc = UUID.test(association_id) ? association_id : '';
  const supabase = await createClient();
  const db = supabase as any;

  // PostgREST can't cast in filters (number::text), so name/number search
  // runs in memory over the whole chart (paged past 1,000 rows).
  const [{ rows, error: glError }, { data: associations }] = await Promise.all([
    fetchAllRows<any>(() => db
      .from('gl_accounts')
      .select('id, number, name, account_type, fund_account, active, include_on_cash_flow, subject_to_management_fees, association_id, sub_account_of_id, associations!gl_accounts_association_id_fkey(name)')
      .order('number')
      .order('id')),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);
  if (glError) throw new Error(`Could not load GL accounts: ${glError}`);
  const needle = q.trim().toLowerCase();
  const accounts = (rows as any[]).filter((a: any) =>
    (!needle || String(a.name ?? '').toLowerCase().includes(needle) || String(a.number ?? '').includes(needle))
    && (status !== 'active' || a.active)
    && (status !== 'inactive' || !a.active)
    // An association's chart is its own accounts plus the company-wide ones.
    && (!assoc || a.association_id === assoc || a.association_id == null));
  const parentById = new Map((rows as any[]).map((a: any) => [a.id, a]));
  // Posted balance; with an association chosen, only that association's lines.
  // Finance only: other staff can't read the ledger, so balances would read 0.
  const balances = isFinance ? await glBalances(db, accounts.map((a: any) => a.id), assoc || null) : null;

  const activeCount = accounts.filter((a: any) => a.active).length;
  const inactiveCount = accounts.filter((a: any) => !a.active).length;
  const fundCount = accounts.filter((a: any) => a.fund_account).length;

  const known = new Set(GROUPS.flatMap((g) => g.types));
  const grouped = [
    ...GROUPS.map((g) => ({ label: g.label, items: accounts.filter((a: any) => g.types.includes(a.account_type)) })),
    { label: 'Other', items: accounts.filter((a: any) => !known.has(a.account_type)) },
  ].filter((g) => g.items.length > 0);

  return (
    <DataWorkspace
      title="GL Accounts"
      description="Chart of accounts, grouped by account type. Open an account to edit or deactivate it."
      actions={<>
        <a href={`/gl-accounts/export?${new URLSearchParams({ q, status, association_id: assoc }).toString()}`}><Button variant="secondary"><Download className="h-4 w-4" /> Export</Button></a>
        {isFinance && <Link href="/gl-accounts/map"><Button variant="secondary">GL account map</Button></Link>}
        {hasPortfolioAdminAccess(me) && <Link href="/gl-accounts/permissions"><Button variant="secondary">Role permissions</Button></Link>}
        {isFinance && <Link href="/gl-accounts/new"><Button><Plus className="h-4 w-4" /> New GL account</Button></Link>}
      </>}
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Total accounts', value: accounts.length, sublabel: 'All GL accounts' },
            { label: 'Active', value: activeCount, sublabel: accounts.length > 0 ? `${((activeCount / accounts.length) * 100).toFixed(0)}% of total` : '—' },
            { label: 'Inactive', value: inactiveCount, sublabel: 'Archived or disabled' },
            { label: 'Fund accounts', value: fundCount, sublabel: 'Mapped to a fund' },
          ]}
        />

        {saved && <Alert tone="success" title="GL account saved" />}
        {created && <Alert tone="success" title="GL account created" />}
        <FilterBar action="/gl-accounts" searchDefault={q} searchPlaceholder="Search by name or account number">
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">All accounts</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FilterSelect>
          <FilterSelect label="Association" name="association_id" defaultValue={assoc}>
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        </FilterBar>

        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={BookOpen}
              title={q || status || assoc ? 'No GL accounts match your filters' : 'No GL accounts configured yet'}
              description="The chart of accounts will appear here, grouped by account range."
              action={isFinance && !q && !status && !assoc && (
                <Link href="/gl-accounts/new">
                  <Button><Plus className="h-4 w-4" /> Create your first GL account</Button>
                </Link>
              )}
            />
          </div>
        ) : grouped.length === 0 && q ? (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState icon={BookOpen} title={`No GL accounts match “${q}”`} />
          </div>
        ) : (
          grouped.map((g) => (
            <section key={g.label}>
              <SectionTitle
                title={g.label}
                actions={
                  <span className="text-[13px] text-gray-500">{g.items.length} account{g.items.length !== 1 ? 's' : ''}</span>
                }
              />
              <Table>
                <THead>
                  <tr>
                    <TH>Number</TH>
                    <TH>Name</TH>
                    <TH>Account Type</TH>
                    <TH>Association</TH>
                    <TH>Fund Account</TH>
                    {balances && <TH className="text-right">Balance</TH>}
                    <TH>Active</TH>
                  </tr>
                </THead>
                <tbody>
                  {g.items.map((a: any) => (
                    <TR key={a.id}>
                      <TD className="font-mono tabular-nums">{a.number}</TD>
                      <TD className="font-medium">
                        {isFinance
                          ? <Link href={`/gl-accounts/${a.id}`} className="text-gray-900 hover:underline">{a.name}</Link>
                          : a.name}
                        {a.sub_account_of_id && parentById.get(a.sub_account_of_id) && (
                          <span className="block text-xs font-normal text-gray-500">
                            Sub-account of {parentById.get(a.sub_account_of_id).number} {parentById.get(a.sub_account_of_id).name}
                          </span>
                        )}
                      </TD>
                      <TD className="capitalize">{a.account_type?.replace(/_/g, ' ')}</TD>
                      <TD className="text-gray-600">{a.associations?.name ?? 'Portfolio-wide'}</TD>
                      <TD className="capitalize text-gray-600">{a.fund_account?.replace(/_/g, ' ') ?? '—'}</TD>
                      {balances && <TD className="text-right tabular-nums">{money(normalBalance(a.account_type, balances.get(a.id) ?? 0))}</TD>}
                      <TD>
                        <StatusChip tone={a.active ? 'success' : 'neutral'}>
                          {a.active ? 'Active' : 'Inactive'}
                        </StatusChip>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </section>
          ))
        )}
      </div>
    </DataWorkspace>
  );
}
