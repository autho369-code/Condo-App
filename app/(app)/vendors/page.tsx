import Link from 'next/link';
import { Plus } from 'lucide-react';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function ComplianceBadges({ vendor }: { vendor: any }) {
  const expirations = [
    { label: 'WC', date: vendor.workers_comp_expiration },
    { label: 'GL', date: vendor.general_liability_expiration },
    { label: 'Lic', date: vendor.state_license_expiration },
    { label: 'Auto', date: vendor.auto_insurance_expiration },
    { label: 'Ctr', date: vendor.contract_expiration },
  ].filter(e => e.date);
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 86400000);

  if (expirations.length === 0) return <span className="text-xs text-gray-400">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {expirations.map((e) => {
        const d = new Date(e.date);
        const expired = d < now;
        const expiring = d <= soon && !expired;
        return (
          <span key={e.label} className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${expired ? 'bg-red-50 text-red-700 ring-red-600/15' : expiring ? 'bg-amber-50 text-amber-700 ring-amber-600/15' : 'bg-gray-100 text-gray-600 ring-gray-500/15'}`}>
            {e.label}: {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        );
      })}
    </div>
  );
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trade?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const trade = sp.trade ?? 'all';

  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('vendors')
    .select('id, name, emails, phone_numbers, trade, vendor_type, payment_type, payment_terms, is_utility, is_auto_pay, send_1099, taxpayer_id, bank_routing_number, bank_account_number, portal_activated, hold_payments, workers_comp_expiration, general_liability_expiration, epa_certification_expiration, auto_insurance_expiration, state_license_expiration, contract_expiration, archived_at')
    .is('archived_at', null)
    .order('name');

  const allRows = data ?? [];
  const trades: string[] = Array.from(new Set(allRows.map((vendor: any) => vendor.trade).filter(Boolean) as string[])).sort();
  let rows = allRows;
  if (trade !== 'all') rows = rows.filter((vendor: any) => vendor.trade === trade);
  if (q) {
    rows = rows.filter((vendor: any) =>
      [vendor.name, vendor.trade, vendor.vendor_type, vendor.payment_type].some((value) => value?.toLowerCase().includes(q)),
    );
  }

  const achReady = allRows.filter((vendor: any) => vendor.bank_routing_number && vendor.bank_account_number).length;
  const w9Needed = allRows.filter((vendor: any) => vendor.send_1099 && !vendor.taxpayer_id).length;
  const paymentHold = allRows.filter((vendor: any) => vendor.hold_payments).length;

  return (
    <DataWorkspace
      title="Vendors"
      description="Manage contractors, utilities, W-9 readiness, ACH setup, compliance documents, and vendor forms."
      actions={
        <Link href="/vendors/new">
          <Button><Plus className="h-4 w-4" /> New vendor</Button>
        </Link>
      }
    >
      <div className="space-y-4">
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          <Link href="/owners" className="whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700">Owners</Link>
          <Link href="/owners?view=directory" className="whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700">Directory</Link>
          <Link href="/vendors" className="whitespace-nowrap border-b-2 border-gray-950 px-4 py-2.5 text-sm font-medium text-gray-950">Vendors</Link>
        </nav>

        <MetricStrip
          metrics={[
            { label: 'Active vendors', value: allRows.length },
            { label: 'ACH ready', value: achReady },
            { label: 'W-9 needed', value: w9Needed },
            { label: 'Payment holds', value: paymentHold },
          ]}
        />

        <FilterBar action="/vendors" searchDefault={sp.q ?? ''} searchPlaceholder="Search vendor, trade, type, or payment method">
          <FilterSelect label="Trade" name="trade" defaultValue={trade}>
            <option value="all">All trades</option>
            {trades.map((item) => <option key={item} value={item}>{String(item).replace(/_/g, ' ')}</option>)}
          </FilterSelect>
        </FilterBar>

        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Trade</TH>
              <TH>Payment</TH>
              <TH>Compliance</TH>
              <TH>Documentation</TH>
              <TH>Workflows</TH>
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR><TD colSpan={6} className="py-10 text-center text-gray-500">No vendors match this filter.</TD></TR>
            ) : (
              rows.map((vendor: any) => (
                <TR key={vendor.id} className="hover:bg-gray-50">
                  <TD>
                    <div className="font-medium text-gray-950">{vendor.name}</div>
                    <div className="mt-1 text-xs text-gray-500">{vendor.vendor_type?.replace(/_/g, ' ') ?? 'general'}</div>
                    {(vendor.emails?.length > 0 || vendor.phone_numbers?.length > 0) && (
                      <div className="mt-1 space-y-0.5">
                        {vendor.emails?.map((e: string) => <div key={e} className="text-xs text-gray-500">{e}</div>)}
                        {vendor.phone_numbers?.map((p: any) => <div key={p.number} className="text-xs text-gray-500">{p.type}: {p.number}</div>)}
                      </div>
                    )}
                  </TD>
                  <TD className="capitalize">{vendor.trade?.replace(/_/g, ' ') ?? 'other'}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <StatusChip tone={vendor.bank_routing_number && vendor.bank_account_number ? 'success' : 'neutral'}>
                        {vendor.payment_type?.replace(/_/g, ' ') ?? 'check'}
                      </StatusChip>
                      {vendor.is_auto_pay && <StatusChip tone="info">Auto-pay</StatusChip>}
                      {vendor.hold_payments && <StatusChip tone="danger">Hold</StatusChip>}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{vendor.payment_terms ?? 'No terms'}</div>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {vendor.is_utility && <StatusChip tone="info">Utility</StatusChip>}
                      {vendor.send_1099 && <StatusChip tone={vendor.taxpayer_id ? 'success' : 'warning'}>{vendor.taxpayer_id ? 'W-9 ready' : 'Need W-9'}</StatusChip>}
                      {vendor.portal_activated && <StatusChip tone="success">Portal</StatusChip>}
                    </div>
                  </TD>
                  <TD>
                    <ComplianceBadges vendor={vendor} />
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link href={`/vendors/ach?vendor=${vendor.id}`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-50">ACH</Link>
                      <Link href={`/vendors/w9?vendor=${vendor.id}`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-50">W-9</Link>
                      <Link href={`/vendors/compliance?vendor=${vendor.id}`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-50">Docs</Link>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
