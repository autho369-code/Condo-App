import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function OwnerPacketsPage({ searchParams }: { searchParams: Promise<{ q?: string; owner?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: owners }, { data: packets }] = await Promise.all([
    db.from('owners').select('id, full_name, email, archived_at').is('archived_at', null).order('full_name'),
    db.from('owner_packets').select('id, owner_id, status, submitted_at').order('created_at', { ascending: false }),
  ]);

  const packetByOwner = new Map();
  for (const p of (packets ?? [])) { if (!packetByOwner.has(p.owner_id)) packetByOwner.set(p.owner_id, p); }

  let rows = (owners ?? []).map((o: any) => ({ owner: o, packet: packetByOwner.get(o.id) || null }));
  if (sp.owner) rows = rows.filter((r: any) => r.owner.id === sp.owner);
  if (q) rows = rows.filter((r: any) => [r.owner.full_name, r.owner.email].some((v: string) => v?.toLowerCase().includes(q)));

  const completed = rows.filter((r: any) => r.packet?.status === 'completed').length;
  const drafts = rows.filter((r: any) => r.packet?.status === 'draft').length;

  return (
    <DataWorkspace
      title="Owner Packets"
      description="Build onboarding packets for owners. Completed entirely on the website — owner info, unit info, emergency contacts, vehicles, pets, communication preferences, and required acknowledgments."
      actions={<Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to homeowners</Link>}
      rail={
        <div className="space-y-2 rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">
          <p>Packets are completed in-app. No PDFs are generated unless admin chooses Export PDF. All data is stored in the database and visible in the owner profile.</p>
        </div>
      }
    >
      <div className="space-y-4">
        <MetricStrip metrics={[
          { label: 'Owners', value: rows.length },
          { label: 'Completed', value: completed },
          { label: 'In Progress', value: drafts },
          { label: 'Not Started', value: rows.length - completed - drafts },
        ]} />
        <FilterBar action="/owners/packets" searchDefault={sp.q ?? ''} searchPlaceholder="Search owner or email" />
        <Table>
          <THead><TR><TH>Owner</TH><TH>Status</TH><TH>Submitted</TH><TH>Action</TH></TR></THead>
          <tbody>
            {rows.map(({ owner, packet }: any) => (
              <TR key={owner.id}>
                <TD>
                  <Link href={`/owners/${owner.id}`} className="font-medium text-blue-700 hover:underline">{owner.full_name}</Link>
                  <div className="mt-1 text-xs text-gray-500">{owner.email}</div>
                </TD>
                <TD>
                  <StatusChip tone={packet?.status === 'completed' ? 'success' : packet ? 'info' : 'neutral'}>
                    {packet?.status?.replace(/_/g, ' ') ?? 'Not started'}
                  </StatusChip>
                </TD>
                <TD className="text-sm text-gray-500">{packet?.submitted_at ? new Date(packet.submitted_at).toLocaleDateString() : '—'}</TD>
                <TD>
                  <Link href={`/owners/forms?owner=${owner.id}&template=owner_packet`} className="text-sm font-medium text-blue-700 hover:underline">
                    {packet ? 'Edit packet' : 'Start packet'}
                  </Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
