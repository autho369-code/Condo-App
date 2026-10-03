import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ExportActions, type ExportTable } from '@/components/export/export-actions';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Tab = 'receipts' | 'charges' | 'bank-deposits' | 'owner-delinquency' | 'chargeback-insights';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'receipts', label: 'Receipts' },
  { key: 'charges', label: 'Charges' },
  { key: 'bank-deposits', label: 'Bank Deposits' },
  { key: 'owner-delinquency', label: 'Owner Delinquency' },
  { key: 'chargeback-insights', label: 'Chargeback Insights' },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROW_CAP = 500;

function parseTab(value: string | undefined): Tab {
  switch (value) {
    case 'receipts':
    case 'charges':
    case 'bank-deposits':
    case 'owner-delinquency':
    case 'chargeback-insights':
      return value;
    default:
      return 'charges';
  }
}

export default async function ChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; filter?: string; association_id?: string; owner?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  // Ids from the URL are interpolated into filters, so accept only UUIDs.
  const owner = UUID.test(sp.owner ?? '') ? sp.owner! : '';
  const assoc = UUID.test(sp.association_id ?? '') ? sp.association_id! : '';
  const filter = sp.filter ?? '';
  const q = (sp.q ?? '').trim();
  // Search text goes into PostgREST or() filters: drop characters that would
  // change the filter syntax.
  const term = q.replace(/[%_,()*"\\]/g, ' ').trim();
  const supabase = await createClient();
  const db = supabase as any;
  const today = todayInZone();

  // ── Homeowner scope: their current units (ownership records, and current
  // occupancies where an ownership record is missing) ──
  let ownerUnitIds: string[] = [];
  let selectedOwner: { id: string; full_name: string | null } | null = null;
  if (owner) {
    const [{ data: owned }, { data: occupied }, { data: o }] = await Promise.all([
      db.from('unit_owners').select('unit_id')
        .eq('owner_id', owner)
        .or(`start_date.is.null,start_date.lte.${today}`)
        .or(`end_date.is.null,end_date.gte.${today}`),
      db.from('occupancies').select('unit_id').eq('owner_id', owner).eq('status', 'current').eq('occupancy_type', 'owner'),
      db.from('owners').select('id, full_name').eq('id', owner).maybeSingle(),
    ]);
    ownerUnitIds = [...new Set([...(owned ?? []), ...(occupied ?? [])].map((r: any) => r.unit_id).filter(Boolean))] as string[];
    selectedOwner = o ?? null;
  }
  const noUnit = '00000000-0000-0000-0000-000000000000';
  const unitScope = ownerUnitIds.length ? ownerUnitIds : [noUnit];

  const { data: associationRows } = await db.from('associations').select('id, name').is('archived_at', null).order('name');
  // Units of the selected association, so database totals follow the filter.
  let assocUnitIds: string[] = [];
  if (assoc) {
    const { rows } = await fetchAllRows<any>(() => db
      .from('units')
      .select('id, buildings!inner(association_id)')
      .eq('buildings.association_id', assoc)
      .order('id'));
    assocUnitIds = rows.map((u) => u.id);
  }
  const totalsUnitIds: string[] | null = assoc
    ? (owner ? assocUnitIds.filter((id) => ownerUnitIds.includes(id)) : assocUnitIds)
    : owner ? ownerUnitIds : null;
  const associations = (associationRows ?? []) as Array<{ id: string; name: string }>;
  const assocName = new Map(associations.map((a) => [a.id, a.name]));

  // ── Receipts ── (searched and filtered in the database, newest first)
  const receiptsBase = () => {
    let r = db.from('receivable_payments_ledger').select('*', { count: 'exact' });
    if (assoc) r = r.eq('association_id', assoc);
    if (owner) r = r.in('unit_id', unitScope);
    if (term) r = r.or(`owner_name.ilike.*${term}*,unit_number.ilike.*${term}*,reference.ilike.*${term}*,association_name.ilike.*${term}*`);
    return r;
  };
  // ── Open charges ──
  const chargesBase = () => {
    let c = db.from('aged_receivables').select('*', { count: 'exact' });
    if (assoc) c = c.eq('association_id', assoc);
    if (owner) c = c.in('unit_id', unitScope);
    if (term) c = c.or(`unit_number.ilike.*${term}*,association_name.ilike.*${term}*,description.ilike.*${term}*`);
    if (filter) c = c.eq('aging_bucket', filter);
    return c;
  };

  const [receiptsRes, chargesRes, receiptAmounts, delinquentRes, unitTotalsRes, categoriesRes] = await Promise.all([
    tab === 'receipts'
      ? receiptsBase().order('payment_date', { ascending: false }).order('payment_id').limit(ROW_CAP)
      : Promise.resolve({ data: [], count: null, error: null }),
    tab === 'charges'
      ? chargesBase().order('due_date').order('charge_id').limit(ROW_CAP)
      : Promise.resolve({ data: [], count: null, error: null }),
    // Receipt totals cover every matching receipt, not just the rows shown.
    fetchAllRows<any>(() => {
      let r = db.from('receivable_payments_ledger').select('payment_id, amount');
      if (assoc) r = r.eq('association_id', assoc);
      if (owner) r = r.in('unit_id', unitScope);
      return r.order('payment_id');
    }),
    fetchAllRows<any>(() => {
      let d = db.from('delinquent_units').select('unit_id, unit_number, association_id, balance, oldest_due');
      if (assoc) d = d.eq('association_id', assoc);
      if (owner) d = d.in('unit_id', unitScope);
      return d.order('unit_id');
    }),
    db.rpc('receivable_unit_totals', { p_unit_ids: totalsUnitIds ? (totalsUnitIds.length ? totalsUnitIds : [noUnit]) : null }),
    owner || assoc
      ? Promise.resolve({ data: [] })
      : db.from('v_charges_by_category').select('*').order('outstanding_balance', { ascending: false }),
  ]);
  const loadErrors = [receiptsRes.error?.message, chargesRes.error?.message, receiptAmounts.error, delinquentRes.error]
    .filter(Boolean) as string[];
  if (receiptAmounts.truncated) loadErrors.push('The receipts total covers the first 50,000 receipts only; choose an association for an exact total.');

  const receipts = (receiptsRes.data ?? []) as any[];
  const receiptsMatching = receiptsRes.count ?? receipts.length;
  const charges = (chargesRes.data ?? []) as any[];
  const chargesMatching = chargesRes.count ?? charges.length;
  const totalReceipts = (receiptAmounts.rows as any[]).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const unitTotals = (Array.isArray(unitTotalsRes.data) ? unitTotalsRes.data[0] : unitTotalsRes.data) ?? null;

  // ── Owner delinquency: who owns each delinquent unit ──
  const delinquentRows = delinquentRes.rows as any[];
  const ownerNamesByUnit = new Map<string, string[]>();
  if (tab === 'owner-delinquency' && delinquentRows.length) {
    const { rows: occ } = await fetchAllRows<any>(() => db
      .from('occupancies')
      .select('id, unit_id, owners(full_name)')
      .in('unit_id', delinquentRows.map((u) => u.unit_id))
      .eq('status', 'current')
      .eq('occupancy_type', 'owner')
      .order('id'));
    for (const o of occ) {
      const name = o.owners?.full_name;
      if (!name) continue;
      ownerNamesByUnit.set(o.unit_id, [...(ownerNamesByUnit.get(o.unit_id) ?? []), name]);
    }
  }
  let delinquent = delinquentRows
    .map((u) => ({
      ...u,
      association_name: assocName.get(u.association_id) ?? '—',
      owner_names: (ownerNamesByUnit.get(u.unit_id) ?? []).join(', '),
      days_past_due: u.oldest_due ? Math.max(0, Math.round((Date.parse(today) - Date.parse(u.oldest_due)) / 86400000)) : 0,
    }))
    .sort((a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0));
  if (q && tab === 'owner-delinquency') {
    const ql = q.toLowerCase();
    delinquent = delinquent.filter((u) =>
      [u.unit_number, u.owner_names, u.association_name].some((v) => String(v ?? '').toLowerCase().includes(ql)));
  }

  // ── Bank deposits: receipts grouped by bank account and date ──
  type Deposit = { key: string; date: string; bank: string; bankName: string; count: number; total: number };
  let deposits: Deposit[] = [];
  let lockboxBatches: any[] = [];
  let depositsTruncated = false;
  if (tab === 'bank-deposits') {
    const [{ rows, truncated }, { data: batches }] = await Promise.all([
      fetchAllRows<any>(() => {
        let r = db.from('receivable_payments_ledger')
          .select('payment_id, payment_date, amount, bank_account_id, bank_account_name, bank_name')
          // Homeowner credits are non-cash: never part of a bank deposit.
          .or('method.is.null,method.neq.credit');
        if (assoc) r = r.eq('association_id', assoc);
        if (owner) r = r.in('unit_id', unitScope);
        return r.order('payment_id');
      }),
      (() => {
        let b = db.from('lockbox_batches')
          .select('id, batch_date, deposit_reference, status, total_amount_cents, total_items, provider, bank_accounts!inner(name, bank_name, association_id)');
        if (assoc) b = b.eq('bank_accounts.association_id', assoc);
        return b.order('batch_date', { ascending: false }).limit(200);
      })(),
    ]);
    depositsTruncated = truncated;
    const byKey = new Map<string, Deposit>();
    for (const r of rows) {
      const key = `${r.payment_date}|${r.bank_account_id ?? 'none'}`;
      const d = byKey.get(key) ?? {
        key, date: r.payment_date, bank: r.bank_account_name ?? 'No bank account recorded', bankName: r.bank_name ?? '', count: 0, total: 0,
      };
      d.count += 1;
      d.total += Number(r.amount ?? 0);
      byKey.set(key, d);
    }
    deposits = [...byKey.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.bank.localeCompare(b.bank)));
    if (q) {
      const ql = q.toLowerCase();
      deposits = deposits.filter((d) => d.bank.toLowerCase().includes(ql) || d.bankName.toLowerCase().includes(ql));
    }
    lockboxBatches = (batches ?? []) as any[];
  }

  // ── Chargebacks: work-order costs charged back to homeowners ──
  let chargebacks: any[] = [];
  let chargebacksTruncated = false;
  {
    const { rows, truncated } = await fetchAllRows<any>(() => {
      let c = db.from('charges')
        .select('id, unit_id, amount, due_date, description, work_order_id, work_orders(id, title), units!inner(unit_number, buildings!inner(association_id))')
        .not('work_order_id', 'is', null);
      if (assoc) c = c.eq('units.buildings.association_id', assoc);
      if (owner) c = c.in('unit_id', unitScope);
      return c.order('id');
    });
    chargebacksTruncated = truncated;
    const ids = rows.map((c) => c.id);
    const balanceById = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: bal } = await db.from('v_charge_balances').select('charge_id, balance_due').in('charge_id', ids.slice(i, i + 200));
      for (const b of (bal ?? []) as any[]) balanceById.set(b.charge_id, Number(b.balance_due ?? 0));
    }
    chargebacks = rows
      .map((c) => ({
        ...c,
        association_name: assocName.get(c.units?.buildings?.association_id) ?? '—',
        balance_due: balanceById.get(c.id) ?? Number(c.amount ?? 0),
      }))
      .sort((a, b) => (a.due_date < b.due_date ? 1 : -1));
    if (q && tab === 'chargeback-insights') {
      const ql = q.toLowerCase();
      chargebacks = chargebacks.filter((c) =>
        [c.units?.unit_number, c.association_name, c.description, c.work_orders?.title]
          .some((v) => String(v ?? '').toLowerCase().includes(ql)));
    }
  }
  const chargebackOpen = chargebacks.filter((c) => c.balance_due > 0.004);
  const chargebackTotal = chargebacks.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const chargebackOpenTotal = chargebackOpen.reduce((s, c) => s + c.balance_due, 0);

  const totalOutstanding = Number(unitTotals?.outstanding_total ?? 0);
  const delinquentCount = assoc ? delinquentRows.length : Number(unitTotals?.delinquent_count ?? delinquentRows.length);
  const overdueBalance = assoc
    ? delinquentRows.reduce((s, u) => s + Number(u.balance ?? 0), 0)
    : Number(unitTotals?.delinquent_balance ?? 0);
  const categoryBreakdown = ((categoriesRes.data ?? []) as any[]).slice(0, 5);

  // ── EXPORT (mirrors the active tab's on-screen table, same filters) ──
  const companyName = me.portfolio?.company_name ?? 'Management company';
  const exportStamp = today;
  let exportTable: ExportTable;
  let exportFooter: string | undefined;
  if (tab === 'receipts') {
    exportTable = {
      title: 'Receipts',
      columns: [
        { header: 'Date' }, { header: 'Payer' }, { header: 'Method' }, { header: 'Unit' },
        { header: 'Association' }, { header: 'Amount', align: 'right' }, { header: 'Reference' },
      ],
      rows: receipts.map((r) => [
        date(r.payment_date), r.owner_name ?? '—', r.method ?? '—', r.unit_number ?? '—',
        r.association_name ?? '—', money(r.amount), r.reference ?? '—',
      ]),
    };
  } else if (tab === 'bank-deposits') {
    exportTable = {
      title: 'Bank Deposits',
      columns: [{ header: 'Date' }, { header: 'Bank Account' }, { header: 'Receipts' }, { header: 'Total', align: 'right' }],
      rows: deposits.map((d) => [date(d.date), d.bank, d.count, money(d.total)]),
    };
  } else if (tab === 'owner-delinquency') {
    exportTable = {
      title: 'Owner Delinquency',
      columns: [
        { header: 'Unit' }, { header: 'Homeowner' }, { header: 'Association' },
        { header: 'Past due', align: 'right' }, { header: 'Oldest due' }, { header: 'Days' },
      ],
      rows: delinquent.map((u) => [
        u.unit_number ?? '—', u.owner_names || '—', u.association_name, money(u.balance), date(u.oldest_due), u.days_past_due,
      ]),
    };
    exportFooter = `Total past due: ${money(delinquent.reduce((s, u) => s + Number(u.balance ?? 0), 0))}`;
  } else if (tab === 'chargeback-insights') {
    exportTable = {
      title: 'Chargeback Insights',
      columns: [
        { header: 'Date' }, { header: 'Unit' }, { header: 'Association' }, { header: 'Work order' },
        { header: 'Charged', align: 'right' }, { header: 'Unpaid', align: 'right' },
      ],
      rows: chargebacks.map((c) => [
        date(c.due_date), c.units?.unit_number ?? '—', c.association_name, c.work_orders?.title ?? c.description ?? '—',
        money(c.amount), money(c.balance_due),
      ]),
    };
    exportFooter = `Charged back: ${money(chargebackTotal)} · Unpaid: ${money(chargebackOpenTotal)}`;
  } else {
    exportTable = {
      title: 'Charges',
      columns: [
        { header: 'Unit' }, { header: 'Association' }, { header: 'Description' },
        { header: 'Balance', align: 'right' }, { header: 'Due' }, { header: 'Aging' },
      ],
      rows: charges.map((c) => [
        c.unit_number ?? '—', c.association_name ?? '—', c.description ?? '—',
        money(c.balance_due), date(c.due_date), formatBucket(c.aging_bucket),
      ]),
    };
    exportFooter = `Total balance due: ${money(charges.reduce((s, c) => s + Number(c.balance_due ?? 0), 0))}`;
  }

  const metrics = [
    { label: 'Receipts', value: receiptAmounts.rows.length, sublabel: `${money(totalReceipts)} total` },
    { label: 'Outstanding', value: money(totalOutstanding), sublabel: 'Open charges less credits' },
    { label: 'Delinquent units', value: delinquentCount, sublabel: `${money(overdueBalance)} past due` },
    { label: 'Chargebacks', value: chargebacks.length, sublabel: `${money(chargebackOpenTotal)} unpaid` },
  ];

  const tabHref = (key: Tab) => {
    const params = new URLSearchParams();
    params.set('tab', key);
    if (owner) params.set('owner', owner);
    if (assoc) params.set('association_id', assoc);
    return `/charges?${params.toString()}`;
  };
  const shownNote = (shown: number, matching: number) =>
    matching > shown ? (
      <p className="text-xs text-gray-500">Showing {shown} of {matching}. Narrow with search or an association to see the rest.</p>
    ) : null;

  return (
    <DataWorkspace
      title="Receivables"
      description="Receipts, open charges, bank deposits, owner delinquency, and work-order chargebacks."
      actions={
        <>
          <ExportActions
            documentTitle="Receivables"
            companyName={companyName}
            filename={`receivables-${tab}-${exportStamp}`}
            tables={[exportTable]}
            footerLine={exportFooter}
          />
          <Link href="/charges/new">
            <Button><Plus className="h-4 w-4" /> New charge</Button>
          </Link>
          {(me.is_finance_staff || me.is_platform_operator) && (
            <Link href="/charges/tasks">
              <Button variant="secondary">Apply credits · Late fees</Button>
            </Link>
          )}
          <Link href="/reports/ar-aging">
            <Button variant="secondary">AR aging report</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {loadErrors.length > 0 && <Alert title="Some receivables could not be loaded.">{loadErrors.join(' · ')}</Alert>}
        {owner ? (
          <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-900 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="font-semibold">Homeowner scope:</span>{' '}
              {selectedOwner?.full_name ?? 'Selected homeowner'}
            </span>
            <Link href={`/charges?tab=${tab}`} className="font-medium text-blue-700 hover:underline">
              Clear homeowner filter
            </Link>
          </div>
        ) : null}
        <MetricStrip metrics={metrics} />

        {/* ── TABS ── */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                t.key === tab ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {/* ── FILTER BAR ── */}
        <FilterBar
          action="/charges"
          searchDefault={q}
          searchPlaceholder={
            tab === 'receipts'
              ? 'Search payer, unit, reference...'
              : tab === 'charges'
              ? 'Search unit, association, description...'
              : tab === 'bank-deposits'
              ? 'Search bank account...'
              : tab === 'chargeback-insights'
              ? 'Search unit, work order...'
              : 'Search unit or homeowner...'
          }
        >
          <input type="hidden" name="tab" value={tab} />
          {owner ? <input type="hidden" name="owner" value={owner} /> : null}
          <FilterSelect label="Association" name="association_id" defaultValue={assoc}>
            <option value="">All associations</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          {tab === 'charges' && (
            <FilterSelect label="Aging" name="filter" defaultValue={filter}>
              <option value="">All aging</option>
              <option value="current">Current</option>
              <option value="1_30">1–30 days</option>
              <option value="31_60">31–60 days</option>
              <option value="61_90">61–90 days</option>
              <option value="90_plus">90+ days</option>
            </FilterSelect>
          )}
        </FilterBar>

        {/* ── TAB: RECEIPTS ── */}
        {tab === 'receipts' && (
          <>
            {receipts.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Payer</TH>
                    <TH>Method</TH>
                    <TH>Unit</TH>
                    <TH>Association</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Reference</TH>
                    <TH />
                  </TR>
                </THead>
                <tbody>
                  {receipts.map((r) => (
                    <TR key={r.payment_id}>
                      <TD className="whitespace-nowrap">{date(r.payment_date)}</TD>
                      <TD className="font-medium text-gray-900">{r.owner_name ?? '—'}</TD>
                      <TD>
                        <StatusChip tone={r.method === 'online' || r.method === 'ach' ? 'info' : r.method === 'check' ? 'warning' : 'neutral'}>
                          {r.method ?? '—'}
                        </StatusChip>
                      </TD>
                      <TD className="font-medium">
                        {r.unit_id ? <Link href={`/units/${r.unit_id}`} className="hover:underline">{r.unit_number ?? '—'}</Link> : r.unit_number ?? '—'}
                      </TD>
                      <TD className="max-w-[180px] truncate text-sm text-gray-600">{r.association_name ?? '—'}</TD>
                      <TD className="text-right font-medium tabular-nums text-gray-900">{money(r.amount)}</TD>
                      <TD className="max-w-[160px] truncate text-sm text-gray-600" title={r.reference ?? ''}>{r.reference ?? '—'}</TD>
                      <TD className="text-right">
                        <Link href={`/payments/${r.payment_id}/receipt`} className="text-xs font-medium text-gray-600 hover:text-gray-950 hover:underline">Receipt</Link>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Surface padded={false}><EmptyState icon={Receipt} title="No receipts match this view" /></Surface>
            )}
            {shownNote(receipts.length, receiptsMatching)}
          </>
        )}

        {/* ── TAB: CHARGES ── */}
        {tab === 'charges' && (
          <>
            {charges.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Unit</TH>
                    <TH>Association</TH>
                    <TH>Description</TH>
                    <TH className="text-right">Balance</TH>
                    <TH>Due</TH>
                    <TH>Aging</TH>
                  </TR>
                </THead>
                <tbody>
                  {charges.map((c) => (
                    <TR key={c.charge_id}>
                      <TD className="font-medium">
                        <Link href={`/units/${c.unit_id}`} className="hover:underline">{c.unit_number ?? '—'}</Link>
                      </TD>
                      <TD className="max-w-[180px] truncate text-sm text-gray-600">{c.association_name ?? '—'}</TD>
                      <TD className="max-w-[300px] truncate text-sm text-gray-700">{c.description ?? '—'}</TD>
                      <TD className="text-right font-medium tabular-nums text-red-600">{money(c.balance_due)}</TD>
                      <TD className="whitespace-nowrap text-sm">{date(c.due_date)}</TD>
                      <TD>
                        <StatusChip tone={c.aging_bucket === 'current' ? 'neutral' : c.aging_bucket === '1_30' || c.aging_bucket === '31_60' ? 'warning' : 'danger'}>
                          {formatBucket(c.aging_bucket)}
                        </StatusChip>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Surface padded={false}><EmptyState icon={Receipt} title="No charges match this view" /></Surface>
            )}
            {shownNote(charges.length, chargesMatching)}

            {categoryBreakdown.length > 0 && (
              <Surface padded={false}>
                <div className="border-b border-gray-100 px-5 py-4">
                  <SectionTitle title="Charges by category" description="Outstanding balance by charge category across all associations." className="mb-0" />
                </div>
                <div className="divide-y divide-gray-100">
                  {categoryBreakdown.map((cat: any) => (
                    <div key={cat.category_id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{cat.category_name ?? '—'}</span>
                        <span className="ml-2 text-xs text-gray-500">({cat.charge_count ?? 0} charges)</span>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-gray-900">{money(cat.outstanding_balance)}</span>
                    </div>
                  ))}
                </div>
              </Surface>
            )}
          </>
        )}

        {/* ── TAB: BANK DEPOSITS ── */}
        {tab === 'bank-deposits' && (
          <>
            {depositsTruncated && <Alert title="Too many receipts to group.">Choose one association to see every deposit.</Alert>}
            {deposits.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Bank Account</TH>
                    <TH className="text-center">Receipts</TH>
                    <TH className="text-right">Deposit Total</TH>
                  </TR>
                </THead>
                <tbody>
                  {deposits.slice(0, ROW_CAP).map((d) => (
                    <TR key={d.key}>
                      <TD className="whitespace-nowrap">{date(d.date)}</TD>
                      <TD>
                        <div className="font-medium text-gray-900">{d.bank}</div>
                        {d.bankName && <div className="text-xs text-gray-500">{d.bankName}</div>}
                      </TD>
                      <TD className="text-center tabular-nums">{d.count}</TD>
                      <TD className="text-right font-medium tabular-nums text-gray-900">{money(d.total)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Surface padded={false}><EmptyState icon={Receipt} title="No bank deposits in this view" /></Surface>
            )}
            {shownNote(Math.min(deposits.length, ROW_CAP), deposits.length)}

            {lockboxBatches.length > 0 && (
              <section>
                <SectionTitle title="Lockbox batches" description="Deposits received through the bank's lockbox service." />
                <Table>
                  <THead>
                    <TR>
                      <TH>Batch Date</TH>
                      <TH>Bank Account</TH>
                      <TH className="text-right">Total</TH>
                      <TH className="text-center">Items</TH>
                      <TH>Reference</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {lockboxBatches.map((b) => (
                      <TR key={b.id}>
                        <TD className="whitespace-nowrap">{date(b.batch_date)}</TD>
                        <TD className="font-medium text-gray-900">{b.bank_accounts?.name ?? '—'}</TD>
                        <TD className="text-right tabular-nums">{money(Number(b.total_amount_cents ?? 0) / 100)}</TD>
                        <TD className="text-center tabular-nums">{b.total_items ?? 0}</TD>
                        <TD className="text-sm text-gray-600">{b.deposit_reference ?? '—'}</TD>
                        <TD>
                          <StatusChip tone={b.status === 'deposited' ? 'success' : b.status === 'reconciled' ? 'info' : b.status === 'pending' ? 'warning' : 'neutral'}>
                            {b.status ?? '—'}
                          </StatusChip>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </section>
            )}
          </>
        )}

        {/* ── TAB: OWNER DELINQUENCY ── */}
        {tab === 'owner-delinquency' && (
          <>
            {delinquent.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Unit</TH>
                    <TH>Homeowner</TH>
                    <TH>Association</TH>
                    <TH className="text-right">Past Due</TH>
                    <TH>Oldest Due</TH>
                    <TH className="text-right">Days</TH>
                  </TR>
                </THead>
                <tbody>
                  {delinquent.map((u) => (
                    <TR key={u.unit_id}>
                      <TD className="font-medium">
                        <Link href={`/units/${u.unit_id}`} className="hover:underline">{u.unit_number ?? '—'}</Link>
                      </TD>
                      <TD className="text-gray-900">{u.owner_names || '—'}</TD>
                      <TD className="max-w-[180px] truncate text-sm text-gray-600">{u.association_name}</TD>
                      <TD className="text-right font-medium tabular-nums text-red-600">{money(u.balance)}</TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(u.oldest_due)}</TD>
                      <TD className="text-right tabular-nums">{u.days_past_due}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Surface padded={false}><EmptyState icon={Receipt} title="No delinquent units in this view" /></Surface>
            )}
          </>
        )}

        {/* ── TAB: CHARGEBACK INSIGHTS ── */}
        {tab === 'chargeback-insights' && (
          <>
            {chargebacksTruncated && <Alert title="Too many chargebacks to list.">Choose one association to see them all.</Alert>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard label="Charged back" value={money(chargebackTotal)} />
              <SummaryCard label="Collected" value={money(chargebackTotal - chargebackOpenTotal)} />
              <SummaryCard label="Unpaid" value={money(chargebackOpenTotal)} />
            </div>
            {chargebacks.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Unit</TH>
                    <TH>Association</TH>
                    <TH>Work Order</TH>
                    <TH className="text-right">Charged</TH>
                    <TH className="text-right">Unpaid</TH>
                  </TR>
                </THead>
                <tbody>
                  {chargebacks.slice(0, ROW_CAP).map((c) => (
                    <TR key={c.id}>
                      <TD className="whitespace-nowrap">{date(c.due_date)}</TD>
                      <TD className="font-medium">
                        <Link href={`/units/${c.unit_id}`} className="hover:underline">{c.units?.unit_number ?? '—'}</Link>
                      </TD>
                      <TD className="max-w-[180px] truncate text-sm text-gray-600">{c.association_name}</TD>
                      <TD className="max-w-[260px] truncate">
                        <Link href={`/work-orders/${c.work_order_id}`} className="text-gray-900 hover:underline">
                          {c.work_orders?.title ?? c.description ?? 'Work order'}
                        </Link>
                      </TD>
                      <TD className="text-right tabular-nums">{money(c.amount)}</TD>
                      <TD className={`text-right font-medium tabular-nums ${c.balance_due > 0.004 ? 'text-red-600' : 'text-gray-500'}`}>{money(c.balance_due)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Surface padded={false}>
                <EmptyState icon={Receipt} title="No chargebacks in this view" description="Work-order costs charged back to a homeowner appear here." />
              </Surface>
            )}
            {shownNote(Math.min(chargebacks.length, ROW_CAP), chargebacks.length)}
          </>
        )}
      </div>
    </DataWorkspace>
  );
}

function formatBucket(bucket: string): string {
  switch (bucket) {
    case 'current':
      return 'Current';
    case '1_30':
      return '1–30d';
    case '31_60':
      return '31–60d';
    case '61_90':
      return '61–90d';
    case '90_plus':
      return '90+d';
    default:
      return bucket;
  }
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Surface padded={false} className="px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
    </Surface>
  );
}
