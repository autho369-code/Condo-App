import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export default async function OtherReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; assoc?: string; payer?: string; voided?: string; q?: string; error?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const from = ISO.test(sp.from ?? '') ? sp.from! : yearStart;
  const to = ISO.test(sp.to ?? '') ? sp.to! : now.toISOString().slice(0, 10);
  const assoc = UUID.test(sp.assoc ?? '') ? sp.assoc! : '';
  const payer = sp.payer === 'vendor' || sp.payer === 'other' ? sp.payer : '';
  const showVoided = sp.voided === '1';
  const q = (sp.q ?? '').trim().toLowerCase();

  const db = (await createClient()) as any;
  const PAGE = 1000;
  const MAX_ROWS = 10000;
  const fetched: any[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    let query = db
      .from('other_receipts')
      .select('id, receipt_date, payer_type, payer_name, vendor_id, reference, memo, amount, voided_at, associations(name), bank_accounts(name)')
      .gte('receipt_date', from)
      .lte('receipt_date', to)
      .order('receipt_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (assoc) query = query.eq('association_id', assoc);
    if (payer) query = query.eq('payer_type', payer);
    if (!showVoided) query = query.is('voided_at', null);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load other receipts: ${error.message}`);
    fetched.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  const { data: associations } = await db.from('associations').select('id, name').is('archived_at', null).order('name');

  const rows = q
    ? fetched.filter((r) => [r.payer_name, r.reference, r.memo, r.associations?.name].some((v) => String(v ?? '').toLowerCase().includes(q)))
    : fetched;
  const live = rows.filter((r) => !r.voided_at);
  const total = live.reduce((sum, r) => sum + Number(r.amount), 0);
  const fromVendors = live.filter((r) => r.payer_type === 'vendor').reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <DataWorkspace
      title="Other receipts"
      description="Vendor refunds, insurance proceeds and other income that isn't a homeowner payment."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/receipts"><Button variant="secondary">Homeowner receipts</Button></Link>
          <Link href="/receipts/other/new"><Button>Record other receipt</Button></Link>
        </div>
      }
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Something went wrong">{sp.error}</Alert>}
        <MetricStrip
          metrics={[
            { label: 'Received', value: money(total), sublabel: `${live.length} receipt${live.length === 1 ? '' : 's'}` },
            { label: 'From vendors', value: money(fromVendors) },
            { label: 'From other payers', value: money(total - fromVendors) },
          ]}
        />

        <FilterBar action="/receipts/other" searchDefault={sp.q ?? ''} searchPlaceholder="Search payer, reference, memo or association">
          <FilterSelect label="Association" name="assoc" defaultValue={assoc}>
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Payer" name="payer" defaultValue={payer}>
            <option value="">All payers</option>
            <option value="vendor">Vendors</option>
            <option value="other">Other payers</option>
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
            <input type="checkbox" name="voided" value="1" defaultChecked={showVoided} /> Include voided
          </label>
        </FilterBar>

        {rows.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={Receipt}
              title="No other receipts in this range"
              description="Record vendor refunds, insurance proceeds and other income here."
            />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Received from</TH>
                <TH>Association</TH>
                <TH>Reference</TH>
                <TH>Deposited to</TH>
                <TH className="text-right">Amount</TH>
              </tr>
            </THead>
            <tbody>
              {rows.slice(0, 500).map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{date(r.receipt_date)}</TD>
                  <TD>
                    <Link href={`/receipts/other/${r.id}`} className="font-medium text-gray-950 hover:underline">{r.payer_name}</Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                      {r.payer_type === 'vendor' ? 'Vendor' : 'Other payer'}
                      {r.voided_at && <StatusChip tone="neutral">Void</StatusChip>}
                    </div>
                  </TD>
                  <TD className="text-sm text-gray-600">{r.associations?.name ?? '—'}</TD>
                  <TD className="text-sm text-gray-600">{r.reference ?? '—'}</TD>
                  <TD className="text-sm text-gray-600">{r.bank_accounts?.name ?? '—'}</TD>
                  <TD className={`text-right tabular-nums ${r.voided_at ? 'text-gray-400 line-through' : ''}`}>{money(r.amount)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        {rows.length > 500 && <p className="text-xs text-gray-500">Showing the newest 500 of {rows.length.toLocaleString()}; totals include all of them.</p>}
      </div>
    </DataWorkspace>
  );
}
