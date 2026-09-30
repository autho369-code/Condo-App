import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { EmptyState, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { RECEIPT_METHODS, receiptMethodLabel } from '@/lib/payments/methods';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; assoc?: string; method?: string; q?: string; credits?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const from = ISO.test(sp.from ?? '') ? sp.from! : monthStart;
  const to = ISO.test(sp.to ?? '') ? sp.to! : now.toISOString().slice(0, 10);
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
  const { data: associations } = await db.from('associations').select('id, name').is('archived_at', null).order('name');

  let rows = fetched;
  if (q) {
    rows = rows.filter((r) =>
      [r.reference, r.notes, r.units?.unit_number, r.units?.buildings?.associations?.name, receiptMethodLabel(r.method)]
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
          <Link href="/bank-accounts/deposits/new"><Button variant="secondary">Other receipt / deposit</Button></Link>
          <Link href="/units"><Button>Record homeowner receipt</Button></Link>
        </div>
      }
    >
      <div className="space-y-4">
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
            <EmptyState icon={Receipt} title="No receipts in this range" description="Change the dates or filters." />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
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
