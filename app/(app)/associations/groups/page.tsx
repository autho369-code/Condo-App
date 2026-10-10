import Link from 'next/link';
import { FolderTree } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Section } from '@/components/workspace/shell';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { hasPortfolioAdminAccess, requireStaff } from '@/lib/auth/me';
import { deletePropertyGroup, savePropertyGroup, setPropertyGroupMembers } from '@/lib/rpcs/property-groups';
import { createClient } from '@/lib/supabase/server';
import { PendingSubmit } from '@/components/ui/pending-submit';

export const dynamic = 'force-dynamic';

export default async function PropertyGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; edit?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const canEdit = hasPortfolioAdminAccess(me);
  const db = (await createClient()) as any;

  const [{ data: groups }, { data: associations }] = await Promise.all([
    db.from('property_groups').select('id, name, description').order('name'),
    db.from('associations').select('id, name, property_group_id, unit_count').is('archived_at', null).order('name'),
  ]);
  const allGroups = (groups ?? []) as { id: string; name: string; description: string | null }[];
  const allAssociations = (associations ?? []) as { id: string; name: string; property_group_id: string | null; unit_count: number | null }[];
  const ungrouped = allAssociations.filter((a) => !a.property_group_id);
  const membersOf = (groupId: string) => allAssociations.filter((a) => a.property_group_id === groupId);

  return (
    <DataWorkspace
      title="Property groups"
      description="Organize associations by manager, region, or service tier. Groups filter the association list and keep large portfolios navigable."
      actions={<Link href="/associations"><Button variant="secondary">All associations</Button></Link>}
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="Could not save:">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}
        {!canEdit && <Alert tone="info">Company admins manage property groups. You can view them here.</Alert>}

        <MetricStrip
          metrics={[
            { label: 'Groups', value: allGroups.length },
            { label: 'Grouped associations', value: allAssociations.length - ungrouped.length },
            { label: 'Ungrouped', value: ungrouped.length },
          ]}
        />

        {allGroups.length === 0 && !canEdit && (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState icon={FolderTree} title="No property groups yet" description="A company admin can create groups here." />
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          {allGroups.map((g) => {
            const members = membersOf(g.id);
            const units = members.reduce((s, a) => s + (a.unit_count ?? 0), 0);
            return (
              <Section
                key={g.id}
                title={g.name}
                subtitle={`${members.length} association${members.length === 1 ? '' : 's'} · ${units.toLocaleString()} units${g.description ? ` — ${g.description}` : ''}`}
                actions={<Link href={`/associations?group=${g.id}`} className="text-[13px] font-medium text-gray-500 hover:text-gray-900">View list</Link>}
                padded
              >
                {canEdit ? (
                  <div className="space-y-5">
                    <form action={setPropertyGroupMembers} className="space-y-3">
                      <input type="hidden" name="group_id" value={g.id} />
                      <div className="grid max-h-72 grid-cols-1 gap-x-4 overflow-y-auto sm:grid-cols-2">
                        {allAssociations.map((a) => {
                          const elsewhere = a.property_group_id && a.property_group_id !== g.id
                            ? allGroups.find((x) => x.id === a.property_group_id)?.name
                            : null;
                          return (
                            <label key={a.id} className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                              <input type="checkbox" name="association_ids" value={a.id} defaultChecked={a.property_group_id === g.id} className="h-4 w-4 rounded border-gray-300" />
                              <span className="truncate">{a.name}</span>
                              {elsewhere && <span className="shrink-0 text-[12.5px] text-gray-400">in {elsewhere}</span>}
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-[12px] text-gray-400">An association belongs to one group; checking it here moves it from its current group.</p>
                      <Button type="submit" variant="secondary" size="sm">Save membership</Button>
                    </form>

                    <details className="border-t border-gray-100 pt-4">
                      <summary className="cursor-pointer text-[13px] font-medium text-gray-600">Rename or delete</summary>
                      <form action={savePropertyGroup} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input type="hidden" name="id" value={g.id} />
                        <Field label="Name"><Input name="name" defaultValue={g.name} required minLength={2} maxLength={80} /></Field>
                        <Field label="Description"><Input name="description" defaultValue={g.description ?? ''} maxLength={500} /></Field>
                        <div><Button type="submit" size="sm">Save</Button></div>
                      </form>
                      <form action={deletePropertyGroup} className="mt-3">
                        <input type="hidden" name="id" value={g.id} />
                        <PendingSubmit variant="danger" size="sm" pendingLabel="Deleting…" confirm="Delete this property group? Its associations are not affected.">Delete group</PendingSubmit>
                      </form>
                    </details>
                  </div>
                ) : (
                  <ul className="space-y-1 text-sm text-gray-700">
                    {members.length ? members.map((a) => <li key={a.id}><Link href={`/associations/${a.id}`} className="hover:text-gray-950">{a.name}</Link></li>) : <li className="text-gray-400">No associations yet.</li>}
                  </ul>
                )}
              </Section>
            );
          })}

          {canEdit && (
            <Section title="New group" padded>
              <form action={savePropertyGroup} className="space-y-3">
                <Field label="Name" htmlFor="new-group-name" required>
                  <Input id="new-group-name" name="name" required minLength={2} maxLength={80} placeholder="e.g. North Side — Anna's portfolio" />
                </Field>
                <Field label="Description" htmlFor="new-group-description">
                  <Input id="new-group-description" name="description" maxLength={500} placeholder="Optional" />
                </Field>
                <Button type="submit">Create group</Button>
              </form>
            </Section>
          )}
        </div>

        {ungrouped.length > 0 && allGroups.length > 0 && (
          <Section title="Ungrouped associations" padded>
            <div className="flex flex-wrap gap-2">
              {ungrouped.map((a) => (
                <Link key={a.id} href={`/associations/${a.id}`} className="inline-flex h-8 items-center rounded-full bg-gray-100 px-3 text-[13px] text-gray-700 hover:bg-gray-200">{a.name}</Link>
              ))}
            </div>
          </Section>
        )}
      </div>
    </DataWorkspace>
  );
}
