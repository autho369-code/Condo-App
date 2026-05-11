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

function expirationTone(expiresAt: string | null) {
  if (!expiresAt) return 'neutral' as const;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'danger' as const;
  if (days <= 30) return 'warning' as const;
  return 'success' as const;
}

export default async function VendorCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vendor?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const [{ data: vendors }, { data: documents }, { data: requests }] = await Promise.all([
    (supabase as any).from('vendors').select('id, name, trade, archived_at').is('archived_at', null).order('name'),
    (supabase as any).from('documents').select('id, entity_id, entity_type, doc_type, file_name, expires_at, uploaded_at').eq('entity_type', 'vendor').order('expires_at', { ascending: true }),
    (supabase as any).from('document_requests').select('id, vendor_id, name, doc_type, status, requested_at, due_date').not('vendor_id', 'is', null).order('requested_at', { ascending: false }).limit(500),
  ]);

  const docsByVendor = new Map<string, any[]>();
  for (const doc of documents ?? []) {
    const vendorId = (doc as any).entity_id;
    docsByVendor.set(vendorId, [...(docsByVendor.get(vendorId) ?? []), doc]);
  }
  const requestsByVendor = new Map<string, any[]>();
  for (const request of requests ?? []) {
    const vendorId = (request as any).vendor_id;
    requestsByVendor.set(vendorId, [...(requestsByVendor.get(vendorId) ?? []), request]);
  }

  let rows: any[] = (vendors ?? []).map((vendor: any) => ({
    vendor,
    docs: docsByVendor.get(vendor.id) ?? [],
    requests: requestsByVendor.get(vendor.id) ?? [],
  }));
  if (sp.vendor) rows = rows.filter((row) => row.vendor.id === sp.vendor);
  if (q) rows = rows.filter((row) => [row.vendor.name, row.vendor.trade, row.docs[0]?.doc_type, row.requests[0]?.status].some((value) => value?.toLowerCase().includes(q)));

  const expiring = (documents ?? []).filter((doc: any) => expirationTone(doc.expires_at) === 'warning').length;
  const expired = (documents ?? []).filter((doc: any) => expirationTone(doc.expires_at) === 'danger').length;

  return (
    <DataWorkspace
      title="Request Vendor Documents"
      description="Track insurance, license, W-9, and compliance documents with expiration and request status."
      actions={<Link href="/vendors/forms?template=document_request" className="inline-flex h-10 items-center rounded-md bg-gray-950 px-4 text-sm font-medium text-white">Request documents</Link>}
      rail={<div className="rounded border border-ink-100 bg-white p-3 text-sm text-ink-700">Use this queue to prevent expired insurance and missing license documents before assigning work orders.</div>}
    >
      <div className="space-y-4">
        <MetricStrip metrics={[
          { label: 'Vendors', value: rows.length },
          { label: 'Documents on file', value: documents?.length ?? 0 },
          { label: 'Expiring soon', value: expiring },
          { label: 'Expired', value: expired },
        ]} />
        <FilterBar action="/vendors/compliance" searchDefault={sp.q ?? ''} searchPlaceholder="Search vendor, document, or status" />
        <Table>
          <THead><TR><TH>Vendor</TH><TH>Documents</TH><TH>Expiration</TH><TH>Request Status</TH><TH>Action</TH></TR></THead>
          <tbody>
            {rows.map(({ vendor, docs, requests: vendorRequests }) => {
              const doc = docs[0];
              const request = vendorRequests[0];
              return (
                <TR key={vendor.id} className="hover:bg-cream-50">
                  <TD><div className="font-medium text-ink-900">{vendor.name}</div><div className="mt-1 text-xs capitalize text-ink-500">{vendor.trade?.replace(/_/g, ' ')}</div></TD>
                  <TD><StatusChip tone={docs.length ? 'success' : 'warning'}>{docs.length} on file</StatusChip><div className="mt-1 text-xs text-ink-500">{doc?.doc_type ?? 'No document uploaded'}</div></TD>
                  <TD><StatusChip tone={expirationTone(doc?.expires_at ?? null)}>{doc?.expires_at ? date(doc.expires_at) : 'No expiration'}</StatusChip></TD>
                  <TD><div className="capitalize">{request?.status?.replace(/_/g, ' ') ?? 'No open request'}</div><div className="mt-1 text-xs text-ink-500">Due {date(request?.due_date)}</div></TD>
                  <TD><Link href={`/vendors/forms?vendor=${vendor.id}&template=document_request`} className="text-sm font-medium text-champagne-700 hover:underline">Stage request</Link></TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
