import { sanitizeSearchTerm } from '@/lib/search/global';
import Link from 'next/link';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { completeBankTransfers } from '@/lib/rpcs/bank-transfers';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { createClient } from '@/lib/supabase/server';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// "All transfers" is the default: a posted transfer is only ever "Completed",
// and the old Individual/Group split keyed on account types that don't exist
// (the enum is checking/savings/money_market), so the default tab was always
// empty and new transfers looked lost.
const TABS = [
  { key: 'activity', label: 'All transfers' },
  { key: 'incomplete', label: 'Incomplete' },
  { key: 'completed', label: 'Completed' },
] as const;
const LEGACY_TABS: Record<string, string> = { 'incomplete-individual': 'incomplete', 'incomplete-group': 'incomplete' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ROW_CAP = 500;

type TabKey = (typeof TABS)[number]['key'];

export default async function BankTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; association_id?: string; date_from?: string; date_to?: string; completed?: string; recorded?: string; error?: string }>;
}) {
  const me = await requireFinanceStaff();
  const sp = await searchParams;
  const rawTab = sp.tab ?? 'activity';
  const tab = LEGACY_TABS[rawTab] ?? rawTab;
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as TabKey) : 'activity';
  const q = sanitizeSearchTerm(sp.q ?? '');
  const assoc = UUID.test(sp.association_id ?? '') ? sp.association_id! : '';
  const dateFrom = DAY.test(sp.date_from ?? '') ? sp.date_from! : '';
  const dateTo = DAY.test(sp.date_to ?? '') ? sp.date_to! : '';
  const canComplete = me.is_finance_staff || me.is_platform_operator;

  const supabase = await createClient();
  const db = supabase as any;

  const [{ rows: associations }, { rows: banks }] = await Promise.all([
    fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id')),
    fetchAllRows<any>(() => db.from('bank_accounts').select('id, name, association_id').order('id')),
  ]);
  const bankList = (banks ?? []) as Array<{ id: string; name: string; association_id: string | null }>;
  // A transfer belongs to an association through its bank accounts.
  const assocBankIds = assoc ? bankList.filter((b) => b.association_id === assoc).map((b) => b.id) : [];
  const nameMatchBankIds = q ? bankList.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())).map((b) => b.id) : [];
  const none = '00000000-0000-0000-0000-000000000000';

  // Every filter runs in the database, so counts and totals cover all transfers.
  const base = (select: string, opts?: { count: 'exact'; head?: boolean }) => {
    let query = db.from('bank_transfers').select(select, opts);
    // Association and search are each "either account / any field" groups;
    // both must hold, so they are combined into one or() filter.
    const groups: string[] = [];
    if (assoc) {
      const ids = (assocBankIds.length ? assocBankIds : [none]).join(',');
      groups.push(`from_bank_account_id.in.(${ids}),to_bank_account_id.in.(${ids})`);
    }
    if (q) {
      // A double-quoted value keeps commas, dots and brackets in the search text.
      const like = `"*${q.replace(/\*/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}*"`;
      const clauses = [`reference_number.ilike.${like}`, `memo.ilike.${like}`];
      if (nameMatchBankIds.length) {
        const ids = nameMatchBankIds.join(',');
        clauses.push(`from_bank_account_id.in.(${ids})`, `to_bank_account_id.in.(${ids})`);
      }
      groups.push(clauses.join(','));
    }
    if (groups.length === 1) query = query.or(groups[0]);
    if (groups.length === 2) query = query.or(`and(or(${groups[0]}),or(${groups[1]}))`);
    if (dateFrom) query = query.gte('transfer_date', dateFrom);
    if (dateTo) query = query.lte('transfer_date', dateTo);
    return query;
  };
  // Void transfers stay in "All transfers" only.
  const withTab = (query: any) =>
    activeTab === 'completed' ? query.not('journal_entry_id', 'is', null).is('voided_at', null)
      : activeTab === 'incomplete' ? query.is('journal_entry_id', null).is('voided_at', null)
        : query;

  const [listRes, { count: incompleteCount }, { count: completedCount }, amounts] = await Promise.all([
    withTab(base(
      `id, amount, transfer_date, reference_number, memo, journal_entry_id, voided_at,
       from:from_bank_account_id(id, name, account_type, bank_name),
       to:to_bank_account_id(id, name, account_type, bank_name)`,
      { count: 'exact' },
    )).order('transfer_date', { ascending: false }).order('id').limit(ROW_CAP),
    base('id', { count: 'exact', head: true }).is('journal_entry_id', null).is('voided_at', null),
    base('id', { count: 'exact', head: true }).not('journal_entry_id', 'is', null).is('voided_at', null),
    // Voided transfers never moved money: keep them out of the total.
    fetchAllRows<any>(() => withTab(base('id, amount')).is('voided_at', null).order('id')),
  ]);
  const transfers = (listRes.data ?? []) as any[];
  const matching = listRes.count ?? transfers.length;
  const totalAmount = (amounts.rows as any[]).reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const loadError = listRes.error?.message ?? amounts.error ?? null;
  const incompleteShown = transfers.filter((t) => !t.journal_entry_id && !t.voided_at);
  const showSelect = canComplete && incompleteShown.length > 0;

  const tabHref = (key: TabKey) => {
    const p = new URLSearchParams({ tab: key });
    if (sp.q) p.set('q', sp.q);
    if (assoc) p.set('association_id', assoc);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    return `/bank-transfers?${p.toString()}`;
  };

  const table = (
    <Table>
      <THead>
        <TR>
          {showSelect && <TH className="w-10"><SelectAllCheckbox targetName="transfer_id" defaultChecked={false} /></TH>}
          <TH>Date</TH>
          <TH>From Account</TH>
          <TH>To Account</TH>
          <TH className="text-right">Amount</TH>
          <TH>Reference #</TH>
          <TH>Memo</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <tbody>
        {transfers.map((t) => (
          <TR key={t.id}>
            {showSelect && (
              <TD>
                {!t.journal_entry_id && !t.voided_at && (
                  <input type="checkbox" name="transfer_id" value={t.id} aria-label="Select transfer" className="h-4 w-4 rounded border-gray-300" />
                )}
              </TD>
            )}
            <TD className="whitespace-nowrap text-sm"><Link href={`/bank-transfers/${t.id}`} className="font-medium text-gray-900 hover:underline">{date(t.transfer_date)}</Link></TD>
            <TD>
              <div className="font-medium text-gray-900">{t.from?.name ?? '—'}</div>
              <div className="text-xs capitalize text-gray-500">{t.from?.account_type?.replace(/_/g, ' ') ?? ''}</div>
            </TD>
            <TD>
              <div className="font-medium text-gray-900">{t.to?.name ?? '—'}</div>
              <div className="text-xs capitalize text-gray-500">{t.to?.account_type?.replace(/_/g, ' ') ?? ''}</div>
            </TD>
            <TD className="text-right font-medium tabular-nums">{money(t.amount)}</TD>
            <TD className="font-mono text-xs text-gray-600">{t.reference_number ?? '—'}</TD>
            <TD className="max-w-xs truncate text-sm text-gray-600">{t.memo ?? '—'}</TD>
            <TD>
              {t.voided_at ? (
                <StatusChip tone="neutral">Void</StatusChip>
              ) : (
                <StatusChip tone={t.journal_entry_id ? 'success' : 'warning'}>
                  {t.journal_entry_id ? 'Completed' : 'Incomplete'}
                </StatusChip>
              )}
            </TD>
          </TR>
        ))}
      </tbody>
    </Table>
  );

  return (
    <DataWorkspace
      title="Bank Transfers"
      description="Transfers between an association's operating, reserve and trust accounts. Incomplete transfers are not yet in the ledger; complete them one by one or as a group."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/bank-accounts/activity"><Button variant="secondary">Bank account activity</Button></Link>
          <Link href="/bank-transfers/new">
            <Button><Plus className="h-4 w-4" /> New bank transfer</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {sp.completed && Number(sp.completed) > 0 && (
          <Alert tone="success" title={`${sp.completed} transfer${sp.completed === '1' ? '' : 's'} completed and posted to the ledger`} />
        )}
        {sp.error && <Alert title="Not every transfer was completed.">{sp.error}</Alert>}
        {sp.recorded && <Alert tone="success" title="Transfer recorded and posted to the ledger" />}
        {loadError && <Alert title="Could not load transfers.">{loadError}</Alert>}

        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map(({ key, label }) => (
            <Link
              key={key}
              href={tabHref(key)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === key ? 'border-b-2 border-gray-950 text-gray-950' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <MetricStrip
          metrics={[
            { label: 'Transfers', value: matching, sublabel: activeTab === 'activity' ? 'All transfers' : 'In this tab' },
            { label: 'Total amount', value: money(totalAmount), sublabel: 'In this tab' },
            {
              label: 'Incomplete',
              value: incompleteCount ?? 0,
              sublabel: <Link href={tabHref('incomplete')} className="font-medium text-gray-500 transition-colors hover:text-gray-900">View queue</Link>,
            },
            {
              label: 'Completed',
              value: completedCount ?? 0,
              sublabel: <Link href={tabHref('completed')} className="font-medium text-gray-500 transition-colors hover:text-gray-900">View completed</Link>,
            },
          ]}
        />

        <FilterBar action="/bank-transfers" searchDefault={sp.q ?? ''} searchPlaceholder="Search reference #, memo or bank account">
          <input type="hidden" name="tab" value={activeTab} />
          <FilterSelect label="Association" name="association_id" defaultValue={assoc}>
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <label className="text-[12px] font-medium text-gray-500">
            From
            <input type="date" name="date_from" defaultValue={dateFrom} className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
          <label className="text-[12px] font-medium text-gray-500">
            To
            <input type="date" name="date_to" defaultValue={dateTo} className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
        </FilterBar>

        {transfers.length > 0 ? (
          showSelect ? (
            <form action={completeBankTransfers} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600">Select incomplete transfers to post them to the ledger.</p>
                <Button type="submit">Complete selected</Button>
              </div>
              {table}
            </form>
          ) : table
        ) : (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={ArrowLeftRight}
              title={
                activeTab === 'incomplete'
                  ? 'No incomplete transfers'
                  : activeTab === 'completed'
                    ? 'No completed transfers'
                    : 'No transfers yet'
              }
              description="Transfers between operating, reserve, and trust accounts will appear here."
              action={
                <Link href="/bank-transfers/new">
                  <Button><Plus className="h-4 w-4" /> New bank transfer</Button>
                </Link>
              }
            />
          </div>
        )}
        {matching > transfers.length && (
          <p className="text-[13px] text-gray-500">Showing the latest {transfers.length} of {matching} transfers. Narrow with dates or an association to see older ones.</p>
        )}
      </div>
    </DataWorkspace>
  );
}
