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

export default async function VendorW9Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vendor?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const [{ data: vendors }, { data: requests }] = await Promise.all([
    (supabase as any)
      .from('vendors')
      .select('id, name, email_echeck_receipt, send_1099, taxpayer_name, taxpayer_id, is_utility, archived_at')
      .is('archived_at', null)
      .order('name'),
    (supabase as any)
      .from('document_requests')
      .select('id, vendor_id, name, doc_type, status, requested_at, due_date')
      .not('vendor_id', 'is', null)
      .order('requested_at', { ascending: false })
      .limit(500),
  ]);

  const latestByVendor = new Map<string, any>();
  for (const request of requests ?? []) {
    const vendorId = (request as any).vendor_id;
    if (!latestByVendor.has(vendorId) && String((request as any).doc_type).toLowerCase().includes('w')) latestByVendor.set(vendorId, request);
  }

  let rows: any[] = (vendors ?? []).map((vendor: any) => ({ vendor, latest: latestByVendor.get(vendor.id) }));
  if (sp.vendor) rows = rows.filter((row) => row.vendor.id === sp.vendor);
  if (q) rows = rows.filter((row) => [row.vendor.name, row.vendor.taxpayer_name, row.latest?.status].some((value) => value?.toLowerCase().includes(q)));

  const needs1099 = (vendors ?? []).filter((vendor: any) => vendor.send_1099).length;
  const missingTin = (vendors ?? []).filter((vendor: any) => vendor.send_1099 && !vendor.taxpayer_id).length;

  return (
    <DataWorkspace
      title="Request Vendor W-9s"
      description="Find 1099 vendors missing taxpayer information and stage W-9 document requests."
      actions={<Link href="/vendors/forms?template=w9_request" className="inline-flex h-10 items-center rounded-md bg-gray-950 px-4 text-sm font-medium text-white">Prepare W-9 request</Link>}
      rail={<div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">W-9 requests are outbound communications and should be reviewed before sending.</div>}
    >
      <div className="space-y-4">
        <MetricStrip metrics={[
          { label: '1099 vendors', value: needs1099 },
          { label: 'Missing TIN', value: missingTin },
          { label: 'W-9 requests', value: latestByVendor.size },
          { label: 'Utility vendors', value: (vendors ?? []).filter((vendor: any) => vendor.is_utility).length },
        ]} />
        <FilterBar action="/vendors/w9" searchDefault={sp.q ?? ''} searchPlaceholder="Search vendor, taxpayer, or request status" />
        <Table>
          <THead><TR><TH>Vendor</TH><TH>1099 Flag</TH><TH>Taxpayer Info</TH><TH>Latest Request</TH><TH>Action</TH></TR></THead>
          <tbody>
            {rows.map(({ vendor, latest }) => (
              <TR key={vendor.id} className="hover:bg-gray-50">
                <TD><div className="font-medium text-gray-950">{vendor.name}</div>{vendor.is_utility && <div className="mt-1 text-xs text-slate-400">Utility</div>}</TD>
                <TD><StatusChip tone={vendor.send_1099 ? 'warning' : 'neutral'}>{vendor.send_1099 ? 'Needs 1099 review' : 'Not marked'}</StatusChip></TD>
                <TD><StatusChip tone={vendor.taxpayer_id ? 'success' : vendor.send_1099 ? 'danger' : 'neutral'}>{vendor.taxpayer_id ? 'TIN on file' : 'Missing TIN'}</StatusChip><div className="mt-1 text-xs text-slate-400">{vendor.taxpayer_name ?? 'No taxpayer name'}</div></TD>
                <TD><div className="capitalize">{latest?.status?.replace(/_/g, ' ') ?? 'No request'}</div><div className="mt-1 text-xs text-slate-400">{date(latest?.requested_at)}</div></TD>
                <TD><Link href={`/vendors/forms?vendor=${vendor.id}&template=w9_request`} className="text-sm font-medium text-blue-700 hover:underline">Stage request</Link></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
