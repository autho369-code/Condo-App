import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { vendorWorkflowCards } from '@/lib/vendors/workflows';

export const dynamic = 'force-dynamic';

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
    .select('id, name, trade, vendor_type, payment_type, payment_terms, is_utility, is_auto_pay, send_1099, taxpayer_id, bank_routing_number, bank_account_number, portal_activated, hold_payments, archived_at')
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
        <>
          <Link href="/vendors/forms" className="inline-flex h-10 items-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 hover:bg-gray-50">
            Send vendor form
          </Link>
          <Link href="/vendors/new"><Button>New vendor</Button></Link>
        </>
      }
      rail={
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-500">Vendor workflows</div>
            <div className="mt-2 space-y-2">
              {vendorWorkflowCards.map((card) => (
                <Link key={card.href} href={card.href} className="block rounded border border-gray-200 p-3 hover:border-brand-300 hover:bg-brand-50">
                  <div className="font-medium text-gray-950">{card.title}</div>
                  <div className="mt-1 text-xs text-gray-500">{card.description}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded border border-green-200 bg-green-50 p-3 text-xs text-green-800">
            Send vendor forms, ACH requests, and W-9s immediately. One click, no staging.
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <nav className="flex flex-wrap gap-5 border-b border-gray-200 text-sm">
          <Link href="/owners" className="border-b-2 border-transparent px-1 pb-2 text-gray-500 hover:text-gray-900">Homeowners</Link>
          <Link href="/owners?view=directory" className="border-b-2 border-transparent px-1 pb-2 text-gray-500 hover:text-gray-900">Owners</Link>
          <Link href="/vendors" className="border-b-2 border-brand-600 px-1 pb-2 font-semibold text-brand-700">Vendors</Link>
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
          <label className="text-xs font-medium uppercase text-gray-500">
            Trade
            <select name="trade" defaultValue={trade} className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900">
              <option value="all">All trades</option>
              {trades.map((item) => <option key={item} value={item}>{String(item).replace(/_/g, ' ')}</option>)}
            </select>
          </label>
        </FilterBar>

        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Trade</TH>
              <TH>Payment</TH>
              <TH>Compliance</TH>
              <TH>Workflows</TH>
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR><TD colSpan={5} className="py-10 text-center text-gray-500">No vendors match this filter.</TD></TR>
            ) : (
              rows.map((vendor: any) => (
                <TR key={vendor.id} className="hover:bg-gray-50">
                  <TD>
                    <div className="font-medium text-gray-950">{vendor.name}</div>
                    <div className="mt-1 text-xs text-gray-500">{vendor.vendor_type?.replace(/_/g, ' ') ?? 'general'}</div>
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
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link href={`/vendors/ach?vendor=${vendor.id}`} className="rounded border border-gray-200 px-2 py-1 text-gray-700 hover:bg-gray-50">ACH</Link>
                      <Link href={`/vendors/w9?vendor=${vendor.id}`} className="rounded border border-gray-200 px-2 py-1 text-gray-700 hover:bg-gray-50">W-9</Link>
                      <Link href={`/vendors/compliance?vendor=${vendor.id}`} className="rounded border border-gray-200 px-2 py-1 text-gray-700 hover:bg-gray-50">Docs</Link>
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
