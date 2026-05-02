import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function VendorAchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vendor?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const { data } = await (supabase as any)
    .from('vendors')
    .select('id, name, trade, payment_type, bank_routing_number, bank_account_number, savings_account, is_auto_pay, auto_pay_setup_at, auto_pay_notes, hold_payments, archived_at')
    .is('archived_at', null)
    .order('name');

  let rows: any[] = data ?? [];
  if (sp.vendor) rows = rows.filter((vendor: any) => vendor.id === sp.vendor);
  if (q) rows = rows.filter((vendor: any) => [vendor.name, vendor.trade, vendor.payment_type].some((value) => value?.toLowerCase().includes(q)));

  const achReady = (data ?? []).filter((vendor: any) => vendor.bank_routing_number && vendor.bank_account_number).length;
  const autoPay = (data ?? []).filter((vendor: any) => vendor.is_auto_pay).length;

  return (
    <DataWorkspace
      title="Vendor ACH Setup"
      description="Review bank readiness, payout method, auto-pay flags, and payment holds before enabling vendor ACH."
      actions={<Link href="/vendors" className="text-sm font-medium text-blue-700 hover:underline">Back to vendors</Link>}
      rail={<div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Vendor ACH setup is confirmation-gated because it changes bank payout behavior.</div>}
    >
      <div className="space-y-4">
        <MetricStrip metrics={[
          { label: 'Vendors reviewed', value: rows.length },
          { label: 'ACH ready', value: achReady },
          { label: 'Auto-pay vendors', value: autoPay },
          { label: 'Missing bank info', value: Math.max((data?.length ?? 0) - achReady, 0) },
        ]} />
        <FilterBar action="/vendors/ach" searchDefault={sp.q ?? ''} searchPlaceholder="Search vendor, trade, or payment type" />
        <Table>
          <THead><TR><TH>Vendor</TH><TH>Payment</TH><TH>Bank Details</TH><TH>Auto-pay</TH><TH>Next Step</TH></TR></THead>
          <tbody>
            {rows.map((vendor: any) => {
              const hasBank = vendor.bank_routing_number && vendor.bank_account_number;
              return (
                <TR key={vendor.id} className="hover:bg-gray-50">
                  <TD><div className="font-medium text-gray-950">{vendor.name}</div><div className="mt-1 text-xs capitalize text-gray-500">{vendor.trade?.replace(/_/g, ' ')}</div></TD>
                  <TD><StatusChip tone={vendor.payment_type === 'ach' ? 'success' : 'neutral'}>{vendor.payment_type?.replace(/_/g, ' ') ?? 'check'}</StatusChip>{vendor.hold_payments && <div className="mt-1"><StatusChip tone="danger">Payment hold</StatusChip></div>}</TD>
                  <TD><StatusChip tone={hasBank ? 'success' : 'warning'}>{hasBank ? 'Bank info on file' : 'Missing bank info'}</StatusChip><div className="mt-1 text-xs text-gray-500">{vendor.savings_account ? 'Savings' : 'Checking'} account</div></TD>
                  <TD><StatusChip tone={vendor.is_auto_pay ? 'info' : 'neutral'}>{vendor.is_auto_pay ? 'Enabled' : 'Not enabled'}</StatusChip><div className="mt-1 text-xs text-gray-500">Setup {date(vendor.auto_pay_setup_at)}</div></TD>
                  <TD><Link href={`/vendors/forms?vendor=${vendor.id}&template=vendor_bank_account`} className="text-sm font-medium text-blue-700 hover:underline">Prepare bank form</Link></TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
