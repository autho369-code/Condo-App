import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { todayInZone } from '@/lib/time/zoned';
import { RECEIPT_METHODS, receiptMethodLabel } from '@/lib/payments/methods';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; range?: string; assoc?: string; method?: string; q?: string; credits?: string; posted?: string; notice?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  // Dates are the office's calendar day, not UTC.
  const today = todayInZone();
  // Quick ranges. The default is the last 12 months: "month to date" opened
  // the register empty on the 1st of every month.
  const presets = receiptRangePresets(today);
  const preset = presets.find((p) => p.key === sp.range);
  const from = preset ? preset.from : ISO.test(sp.from ?? '') ? sp.from! : presets.find((p) => p.key === '12m')!.from;
  const toInput = preset ? preset.to : ISO.test(sp.to ?? '') ? sp.to! : today;
  const to = toInput < from ? from : toInput;
  const activeRange = preset?.key ?? (!sp.from && !sp.to ? '12m' : '');
  const assoc = UUID.test(sp.assoc ?? '') ? sp.assoc! : '';
  const method = sp.method === 'credit' || RECEIPT_METHODS.some((m) => m.value === sp.method) ? sp.method! : '';
  const includeCredits = sp.credits === '1' || method === 'credit';
  const q = (sp.q ?? '').trim().toLowerCase();

  const db = (await createClient()) as any;
  // Page through the whole filtered range so totals are complete; the
  // association filter runs in the database (inner join), not after a limit.
  const PAGE = 1000;
  const MAX_ROWS = 20000;
  const unitSelect = assoc
    ? 'units!inner(unit_number, buildings!inner(association_id, associations(id, name)))'
    : 'units(unit_number, buildings(association_id, associations(id, name)))';
  const fetched: any[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    let query = db
      .from('payments')
      .select(`id, amount, payment_date, method, reference, notes, processor, unit_id, created_at, bank_accounts(name), ${unitSelect}`)
      .gte('payment_date', from)
      .lte('payment_date', to)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (assoc) query = query.eq('units.buildings.association_id', assoc);
    if (method) query = query.eq('method', method);
    else if (!includeCredits) query = query.neq('method', 'credit');
    const { data, error } = await query;
    if (error) throw new Error(`Could not load receipts: ${error.message}`);
    fetched.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  const truncated = fetched.length >= MAX_ROWS;
  const postedId = UUID.test(sp.posted ?? '') ? sp.posted! : '';
  const posted = postedId
    ? (await db.from('payments').select('id, amount, units(unit_number)').eq('id', postedId).maybeSingle()).data
    : null;
  const keep = (extra: Record<string, string>) => {
    const qs = new URLSearchParams();
    if (assoc) qs.set('assoc', assoc);
    if (method) qs.set('method', method);
    if (includeCredits) qs.set('credits', '1');
    if (sp.q) qs.set('q', sp.q);
    for (const [k, v] of Object.entries(extra)) qs.set(k, v);
    return qs.toString();
  };
  const rangeQuery = (key: string) => keep({ range: key });
  const exportQuery = keep({ from, to });
  const { data: associations } = await db.from('associations').select('id, name').is('archived_at', null).order('name');

  // Who paid: the homeowner who owned the unit on the payment date.
  const payerById = new Map<string, string>();
  const ids = fetched.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('receivable_payments_ledger').select('payment_id, owner_name').in('payment_id', ids.slice(i, i + 200));
    if (error) throw new Error(`Could not load homeowners: ${error.message}`);
    for (const row of data ?? []) if (row.owner_name) payerById.set(row.payment_id, row.owner_name);
  }

  let rows = fetched;
  if (q) {
    rows = rows.filter((r) =>
      [payerById.get(r.id), r.reference, r.notes, r.units?.unit_number, r.units?.buildings?.associations?.name, receiptMethodLabel(r.method)]
        .some((v) => String(v ?? '').toLowerCase().includes(q)),
    );
  }
  const cash = rows.filter((r) => r.method !== 'credit');
  const total = cash.reduce((s, r) => s + Number(r.amount), 0);
  const online = cash.filter((r) => r.method === 'online' || r.processor).reduce((s, r) => s + Number(r.amount), 0);
  const credits = rows.filter((r) => r.method === 'credit').reduce((s, r) => s + Number(r.amount), 0);

  return (
    <DataWorkspace
      title="Receipts"
      description="Every homeowner payment received, across all associations."
      actions={
        <div className="flex flex-wrap gap-2">
          <a href={`/receipts/export?${exportQuery}`}><Button variant="secondary">Export CSV</Button></a>
          <Link href="/receipts/other"><Button variant="secondary">Other receipts</Button></Link>
          <Link href="/receipts/new"><Button>Homeowner receipt</Button></Link>
        </div>
      }
    >
      <div className="space-y-4">
        {sp.notice === 'receipt_in_progress' && (
          <Alert tone="warning" title="That receipt was already submitted.">
            It is being saved from your first click. Check the list below before entering it again.
          </Alert>
        )}
        {posted && (
          <Alert tone="success" title="Receipt recorded.">
            {money(posted.amount)} from Unit {posted.units?.unit_number ?? '—'} was applied and posted to the ledger.{' '}
            <Link href={`/payments/${posted.id}/receipt`} className="font-medium underline">Print receipt</Link>
            {' · '}
            <Link href="/receipts/new" className="font-medium underline">Enter another</Link>
          </Alert>
        )}

        <nav aria-label="Date range" className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Link
              key={p.key}
              href={`/receipts?${rangeQuery(p.key)}`}
              aria-current={activeRange === p.key ? 'true' : undefined}
              className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-[13px] font-medium transition-colors ${
                activeRange === p.key ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </Link>
          ))}
        </nav>

        <MetricStrip
          metrics={[
            { label: 'Received', value: money(total), sublabel: `${cash.length} receipt${cash.length === 1 ? '' : 's'}` },
            { label: 'Paid online', value: total > 0 ? `${Math.round((online / total) * 100)}%` : '—', sublabel: money(online) },
            { label: 'Average receipt', value: cash.length ? money(total / cash.length) : '—' },
            ...(includeCredits ? [{ label: 'Credits given', value: money(credits) }] : []),
          ]}
        />

        <FilterBar action="/receipts" searchDefault={sp.q ?? ''} searchPlaceholder="Search reference, unit, association or note">
          <FilterSelect label="Association" name="assoc" defaultValue={assoc}>
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Method" name="method" defaultValue={method}>
            <option value="">All methods</option>
            {RECEIPT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            <option value="credit">Credits only</option>
          </FilterSelect>
          <div>
            <Label htmlFor="from" className="text-[12px] text-gray-500">From</Label>
            <Input id="from" name="from" type="date" defaultValue={from} />
          </div>
          <div>
            <Label htmlFor="to" className="text-[12px] text-gray-500">To</Label>
            <Input id="to" name="to" type="date" defaultValue={to} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-gray-600">
            <input type="checkbox" name="credits" value="1" defaultChecked={includeCredits} /> Include credits
          </label>
        </FilterBar>

        {truncated && <p className="text-xs text-amber-700">This range has more than 20,000 receipts — totals cover the newest 20,000. Narrow the dates to see all.</p>}

        {rows.length > 500 && <p className="text-xs text-gray-500">Showing the newest 500 of {rows.length.toLocaleString()} receipts; totals include all of them.</p>}
        {rows.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={Receipt}
              title="No receipts in this range"
              description={`Nothing received between ${date(from)} and ${date(to)} with these filters.`}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href={`/receipts?${rangeQuery('all')}`}><Button variant="secondary">Show all dates</Button></Link>
                  <Link href="/receipts/new"><Button>Record a homeowner receipt</Button></Link>
                </div>
              }
            />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Homeowner</TH>
                <TH>Association · unit</TH>
                <TH>Method</TH>
                <TH>Reference</TH>
                <TH>Deposited to</TH>
                <TH className="text-right">Amount</TH>
                <TH><span className="sr-only">Receipt</span></TH>
              </tr>
            </THead>
            <tbody>
              {rows.slice(0, 500).map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{date(r.payment_date)}</TD>
                  <TD className="text-sm text-gray-900">{payerById.get(r.id) ?? '—'}</TD>
                  <TD>
                    <Link href={`/units/${r.unit_id}`} className="text-gray-950 hover:underline">
                      {r.units?.buildings?.associations?.name ?? '—'} · Unit {r.units?.unit_number ?? '—'}
                    </Link>
                    {r.method === 'credit' && r.notes && <div className="text-xs text-gray-500">{r.notes}</div>}
                  </TD>
                  <TD>{receiptMethodLabel(r.method)}</TD>
                  <TD className="text-sm text-gray-600">{r.reference ?? '—'}</TD>
                  <TD className="text-sm text-gray-600">{r.method === 'credit' ? '—' : r.bank_accounts?.name ?? 'Operating'}</TD>
                  <TD className={`text-right tabular-nums ${r.method === 'credit' ? 'text-gray-500' : ''}`}>{money(r.amount)}</TD>
                  <TD className="text-right">
                    <Link href={`/payments/${r.id}/receipt`}><Button variant="ghost" size="sm">{r.method === 'credit' ? 'Memo' : 'Receipt'}</Button></Link>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}

/** Quick ranges relative to `today` (YYYY-MM-DD in the display time zone). */
function receiptRangePresets(today: string) {
  const [y, m, d] = today.split('-').map(Number);
  const daysAgo = (n: number) => new Date(Date.UTC(y, m - 1, d) - n * 86400000).toISOString().slice(0, 10);
  return [
    { key: 'mtd', label: 'This month', from: `${today.slice(0, 7)}-01`, to: today },
    { key: '30d', label: 'Last 30 days', from: daysAgo(30), to: today },
    { key: '90d', label: 'Last 90 days', from: daysAgo(90), to: today },
    { key: 'ytd', label: 'Year to date', from: `${y}-01-01`, to: today },
    { key: '12m', label: 'Last 12 months', from: daysAgo(365), to: today },
    { key: 'ly', label: 'Last year', from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { key: 'all', label: 'All dates', from: '1900-01-01', to: '2999-12-31' },
  ];
}
