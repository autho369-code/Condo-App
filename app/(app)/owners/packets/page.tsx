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

export default async function OwnerPacketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; owner?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const [{ data: owners }, { data: requests }] = await Promise.all([
    (supabase as any).from('owners').select('id, full_name, email, portal_activated, archived_at').is('archived_at', null).order('full_name'),
    (supabase as any)
      .from('document_requests')
      .select('id, owner_id, name, doc_type, status, requested_at, due_date')
      .not('owner_id', 'is', null)
      .order('requested_at', { ascending: false })
      .limit(500),
  ]);

  const requestsByOwner = new Map<string, any[]>();
  for (const request of requests ?? []) {
    const ownerId = (request as any).owner_id;
    requestsByOwner.set(ownerId, [...(requestsByOwner.get(ownerId) ?? []), request]);
  }

  let rows: any[] = (owners ?? []).map((owner: any) => ({ owner, requests: requestsByOwner.get(owner.id) ?? [] }));
  if (sp.owner) rows = rows.filter((row) => row.owner.id === sp.owner);
  if (q) rows = rows.filter((row) => [row.owner.full_name, row.owner.email].some((value) => value?.toLowerCase().includes(q)));

  const openRequests = (requests ?? []).filter((request: any) => !['approved', 'rejected'].includes(request.status)).length;

  return (
    <DataWorkspace
      title="Send Owner Packets"
      description="Assemble packet-ready owners, confirm documents, and stage outbound owner packet delivery."
      actions={<Link href="/owners/forms?template=owner_packet" className="inline-flex h-10 items-center rounded-md bg-gray-950 px-4 text-sm font-medium text-white">Prepare packet</Link>}
      rail={<div className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">Packets should include association rules, payment setup, portal activation, emergency contacts, and any building-specific move instructions.</div>}
    >
      <div className="space-y-4">
        <MetricStrip metrics={[
          { label: 'Packet candidates', value: rows.length },
          { label: 'Open document requests', value: openRequests },
          { label: 'Portal active', value: rows.filter((row) => row.owner.portal_activated).length },
          { label: 'No packet request', value: rows.filter((row) => row.requests.length === 0).length },
        ]} />
        <FilterBar action="/owners/packets" searchDefault={sp.q ?? ''} searchPlaceholder="Search owner or email" />
        <Table>
          <THead><TR><TH>Owner</TH><TH>Portal</TH><TH>Packet Requests</TH><TH>Latest Activity</TH><TH>Next Step</TH></TR></THead>
          <tbody>
            {rows.map(({ owner, requests: ownerRequests }) => {
              const latest = ownerRequests[0];
              return (
                <TR key={owner.id} className="hover:bg-gray-50">
                  <TD><Link href={`/owners/${owner.id}`} className="font-medium text-blue-700 hover:underline">{owner.full_name}</Link><div className="mt-1 text-xs text-gray-500">{owner.email}</div></TD>
                  <TD><StatusChip tone={owner.portal_activated ? 'success' : 'warning'}>{owner.portal_activated ? 'Ready' : 'Activate first'}</StatusChip></TD>
                  <TD><StatusChip tone={ownerRequests.length ? 'info' : 'neutral'}>{ownerRequests.length} requests</StatusChip></TD>
                  <TD><div className="text-gray-900">{latest?.name ?? 'No packet activity'}</div><div className="mt-1 text-xs text-gray-500">{date(latest?.requested_at)}</div></TD>
                  <TD><Link href={`/owners/forms?owner=${owner.id}&template=owner_packet`} className="text-sm font-medium text-blue-700 hover:underline">Preview packet</Link></TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
