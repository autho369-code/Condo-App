import { notFound } from 'next/navigation';
import { AssociationTabs } from '@/components/associations/tabs';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { resolveAssociation } from '@/lib/associations/resolve';
import { requireStaff } from '@/lib/auth/me';
import { createUnitGroup, deleteUnitGroup, setUnitGroupMembers } from '@/lib/rpcs/association-record';
import { createClient } from '@/lib/supabase/server';
import { PendingSubmit } from '@/components/ui/pending-submit';

export const dynamic = 'force-dynamic';

export default async function UnitGroupsTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireStaff();
  const { id: ref } = await params;
  const sp = await searchParams;
  const association = await resolveAssociation(ref);
  if (!association) notFound();
  const id = association.id;
  const db = (await createClient()) as any;
  const back = `/associations/${ref}/unit-groups`;

  const [{ data: groups }, { data: members }, { data: units }] = await Promise.all([
    db.from('unit_groups').select('id, name, description').eq('association_id', id).order('name'),
    db.from('unit_group_members').select('group_id, unit_id'),
    db.from('units').select('id, unit_number, buildings!inner(association_id, name)').eq('buildings.association_id', id).is('archived_at', null).order('unit_number'),
  ]);
  const byGroup = new Map<string, Set<string>>();
  for (const m of members ?? []) {
    if (!byGroup.has(m.group_id)) byGroup.set(m.group_id, new Set());
    byGroup.get(m.group_id)!.add(m.unit_id);
  }
  const allUnits = (units ?? []) as any[];

  return (
    <Workspace
      header={<><AssociationTabs associationId={id} active="unit-groups" /><WorkspaceHeader title="Unit groups" subtitle="Named sets of units — e.g. a tower, garage units, or a phase — for targeting charges, notices, and reports." /></>}
    >
      {sp.error && <Alert tone="danger" title="Could not save:" className="mb-4">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-4">{sp.saved}</Alert>}

      <div className="grid gap-6 xl:grid-cols-2">
        {(groups ?? []).map((g: any) => {
          const set = byGroup.get(g.id) ?? new Set<string>();
          return (
            <Section key={g.id} title={g.name} subtitle={`${set.size} unit${set.size === 1 ? '' : 's'}${g.description ? ` — ${g.description}` : ''}`} padded>
              <form action={setUnitGroupMembers} className="space-y-3">
                <input type="hidden" name="association_id" value={id} />
                <input type="hidden" name="group_id" value={g.id} />
                <input type="hidden" name="back" value={back} />
                <div className="grid max-h-72 grid-cols-2 gap-x-4 overflow-y-auto sm:grid-cols-3">
                  {allUnits.map((u) => (
                    <label key={u.id} className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" name="unit_ids" value={u.id} defaultChecked={set.has(u.id)} className="h-4 w-4 rounded border-gray-300" />
                      {u.unit_number}{u.buildings?.name ? <span className="text-[12.5px] text-gray-400">· {u.buildings.name}</span> : null}
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button type="submit" variant="secondary" size="sm">Save units</Button>
                </div>
              </form>
              <form action={deleteUnitGroup} className="mt-2 text-right">
                <input type="hidden" name="association_id" value={id} />
                <input type="hidden" name="group_id" value={g.id} />
                <input type="hidden" name="back" value={back} />
                <PendingSubmit variant="ghost" size="sm" pendingLabel="Deleting…" confirm="Delete this unit group? Its units are not affected.">Delete group</PendingSubmit>
              </form>
            </Section>
          );
        })}

        <Section title="New unit group" padded>
          <form action={createUnitGroup} className="space-y-3">
            <input type="hidden" name="association_id" value={id} />
            <input type="hidden" name="back" value={back} />
            <Field label="Name" htmlFor="name" required><Input id="name" name="name" required maxLength={80} placeholder="e.g. North tower" /></Field>
            <Field label="Description" htmlFor="description"><Input id="description" name="description" maxLength={300} /></Field>
            <Button type="submit">Create group</Button>
          </form>
        </Section>
      </div>

      {(groups ?? []).length === 0 && allUnits.length === 0 && (
        <EmptyState title="No units yet" description="Add units to this association before grouping them." />
      )}
    </Workspace>
  );
}
