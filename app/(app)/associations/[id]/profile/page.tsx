import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section, Tile } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function AssociationProfileTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations')
    .select(`
      id, name, address, address_line_2, city, state, zip,
      portfolio_id, status, archived_at, created_at,
      portfolio:portfolios ( id, company_name )
    `)
    .eq('id', id)
    .maybeSingle();
  if (aErr || !assoc) notFound();

  // Roll-up counts in parallel
  const buildingsRes = await (supabase as any).from('buildings').select('id').eq('association_id', id);
  const buildingIds = (buildingsRes.data ?? []).map((b: any) => b.id);

  const [unitsRes, boardRes, committeesRes, amenitiesRes, approvalsRes] = await Promise.all([
    buildingIds.length
      ? (supabase as any).from('units').select('id', { count: 'exact', head: true }).in('building_id', buildingIds).is('archived_at', null)
      : Promise.resolve({ count: 0 }),
    (supabase as any).from('board_members').select('id', { count: 'exact', head: true }).eq('association_id', id).eq('active', true),
    (supabase as any).from('committees').select('id', { count: 'exact', head: true }).eq('association_id', id).is('archived_at', null),
    (supabase as any).from('association_amenities').select('id', { count: 'exact', head: true }).eq('association_id', id).is('archived_at', null),
    (supabase as any).from('approval_requests').select('id', { count: 'exact', head: true }).eq('association_id', id).eq('status', 'pending'),
  ]);

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="profile" />
          <WorkspaceHeader
            title={assoc.name}
            actions={<Button size="sm" variant="secondary">Edit</Button>}
          />
        </>
      }
      rail={rail}
    >
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Units"             value={unitsRes.count ?? 0}      href={`/associations/${id}/units`} />
        <Tile label="Board Members"     value={boardRes.count ?? 0}      href={`/associations/${id}/board`} />
        <Tile label="Committees"        value={committeesRes.count ?? 0} href={`/associations/${id}/committees`} />
        <Tile label="Amenities"         value={amenitiesRes.count ?? 0}  href={`/associations/${id}/amenities`} />
        <Tile label="Pending Approvals" value={approvalsRes.count ?? 0}  href={`/associations/${id}/approvals`} tone={(approvalsRes.count ?? 0) > 0 ? 'warning' : 'neutral'} />
      </div>

      <Section title="Association Information" padded>
        <dl className="grid grid-cols-[180px_1fr] gap-y-2.5 text-sm">
          <dt className="text-ink-500">Name</dt>
          <dd className="text-ink-900">{assoc.name}</dd>

          <dt className="text-ink-500">Address</dt>
          <dd className="text-ink-900">
            {assoc.address || <span className="text-ink-400">—</span>}
            {assoc.address_line_2 ? `, ${assoc.address_line_2}` : ''}
            {(assoc.city || assoc.state || assoc.zip) && (
              <div>{[assoc.city, assoc.state].filter(Boolean).join(', ')} {assoc.zip ?? ''}</div>
            )}
          </dd>

          <dt className="text-ink-500">Portfolio</dt>
          <dd className="text-ink-900">{(assoc.portfolio as any)?.company_name ?? <span className="text-ink-400">—</span>}</dd>

          <dt className="text-ink-500">Status</dt>
          <dd className="capitalize text-ink-900">{assoc.status ?? 'active'}</dd>

          <dt className="text-ink-500">Created</dt>
          <dd className="text-ink-900">{assoc.created_at ? formatDate(assoc.created_at) : <span className="text-ink-400">—</span>}</dd>
        </dl>
      </Section>
    </Workspace>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}
