import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';

export const dynamic = 'force-dynamic';

export default async function CommitteesTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireStaff();
  const { id: assocParam } = await params;
  const sp = await searchParams;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations').select('id, name').eq('id', id).maybeSingle();
  if (aErr || !assoc) notFound();

  // Association owners, for the member-add dropdowns
  const { data: assocOwners } = await (supabase as any)
    .from('occupancies')
    .select('owner_id, owners(id, full_name), units!inner(id, buildings!inner(association_id))')
    .eq('status', 'current')
    .eq('units.buildings.association_id', id);
  const ownerOptions: { id: string; name: string }[] = [];
  const seenOwners = new Set<string>();
  for (const o of (assocOwners ?? []) as any[]) {
    if (o.owners?.id && !seenOwners.has(o.owners.id)) {
      seenOwners.add(o.owners.id);
      ownerOptions.push({ id: o.owners.id, name: o.owners.full_name });
    }
  }
  ownerOptions.sort((a, b) => a.name.localeCompare(b.name));

  async function createCommittee(formData: FormData) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/committees?error=${encodeURIComponent(msg)}`);
    const name = ((formData.get('name') as string) || '').trim();
    if (!name) fail('Committee name is required.');
    const { data: committee, error } = await (sb as any)
      .from('committees')
      .insert({ association_id: id, name, description: ((formData.get('description') as string) || '').trim() || null })
      .select('id')
      .single();
    if (error) fail(error.message);
    const chairId = ((formData.get('chair_owner_id') as string) || '').trim();
    if (chairId) {
      const { error: mErr } = await (sb as any).from('committee_members').insert({
        committee_id: committee.id, owner_id: chairId, role: 'Chair', joined_at: new Date().toISOString().slice(0, 10),
      });
      if (mErr) fail(`Committee created, but adding the chair failed: ${mErr.message}`);
    }
    revalidatePath(`/associations/${assocParam}/committees`);
    redirect(`/associations/${assocParam}/committees?saved=1`);
  }

  async function addMember(committeeId: string, formData: FormData) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/committees?error=${encodeURIComponent(msg)}`);
    const ownerId = ((formData.get('owner_id') as string) || '').trim();
    if (!ownerId) fail('Pick an owner to add.');
    const { error } = await (sb as any).from('committee_members').insert({
      committee_id: committeeId,
      owner_id: ownerId,
      role: ((formData.get('role') as string) || '').trim() || 'Member',
      joined_at: new Date().toISOString().slice(0, 10),
    });
    if (error) fail(error.message);
    revalidatePath(`/associations/${assocParam}/committees`);
    redirect(`/associations/${assocParam}/committees`);
  }

  async function removeMember(memberId: string) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/committees?error=${encodeURIComponent(msg)}`);
    const { error } = await (sb as any).from('committee_members').update({ left_at: new Date().toISOString().slice(0, 10) }).eq('id', memberId);
    if (error) fail(error.message);
    revalidatePath(`/associations/${assocParam}/committees`);
    redirect(`/associations/${assocParam}/committees`);
  }

  const { data: committees } = await (supabase as any)
    .from('committees')
    .select(`
      id, name, description,
      members:committee_members (
        id, role, joined_at, left_at,
        owner:owners ( id, full_name, email )
      )
    `)
    .eq('association_id', id)
    .is('archived_at', null)
    .order('name');

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="committees" />
          <WorkspaceHeader
            title="Committees"
            subtitle={assoc.name}
          />
        </>
      }
      rail={rail}
    >
      {sp.error && <div className="mb-4"><Alert tone="danger" title="Action failed">{sp.error}</Alert></div>}
      {sp.saved && <div className="mb-4"><Alert tone="success" title="Committee created" /></div>}

      <Section title="New committee" padded>
        <form action={createCommittee} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="e.g. Landscaping Committee" />
          </div>
          <div>
            <Label htmlFor="description">Purpose</Label>
            <Input id="description" name="description" placeholder="What this committee handles" />
          </div>
          <div>
            <Label htmlFor="chair_owner_id">Chair (optional)</Label>
            <select id="chair_owner_id" name="chair_owner_id" defaultValue="" className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
              <option value="">— No chair yet —</option>
              {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end sm:col-span-3">
            <Button type="submit">Create committee</Button>
          </div>
        </form>
      </Section>

      {(!committees || committees.length === 0) ? (
        <Section padded>
          <p className="text-center text-sm italic text-gray-500">
            No committees yet. Create one above to get started.
          </p>
        </Section>
      ) : committees.map((c: any) => {
        const activeMembers = (c.members ?? []).filter((m: any) => !m.left_at);
        return (
          <Section
            key={c.id}
            title={c.name}
            subtitle={c.description}
            actions={<span className="text-xs text-gray-500">{activeMembers.length} member{activeMembers.length === 1 ? '' : 's'}</span>}
          >
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Role</th>
                  <th className="px-4 py-2 text-left font-semibold">Joined</th>
                  <th className="px-4 py-2 text-left font-semibold">Email</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {activeMembers.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No members on this committee.</td></tr>
                ) : activeMembers.map((m: any) => (
                  <tr key={m.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {m.owner ? (
                        <Link href={`/owners/${m.owner.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{m.owner.full_name}</Link>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.role || <span className="text-gray-400">Member</span>}</td>
                    <td className="px-4 py-3 text-gray-700">{m.joined_at ? formatDate(m.joined_at) : <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {m.owner?.email ? <a href={`mailto:${m.owner.email}`} className="text-blue-700 hover:underline">{m.owner.email}</a> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={removeMember.bind(null, m.id)}>
                        <button type="submit" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-600">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={addMember.bind(null, c.id)} className="flex flex-wrap items-end gap-2 border-t border-gray-100 px-4 py-3">
              <div className="min-w-[200px]">
                <Label htmlFor={`owner-${c.id}`}>Add member</Label>
                <select id={`owner-${c.id}`} name="owner_id" required defaultValue="" className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                  <option value="" disabled>Select owner…</option>
                  {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="w-36">
                <Label htmlFor={`role-${c.id}`}>Role</Label>
                <Input id={`role-${c.id}`} name="role" placeholder="Member" />
              </div>
              <Button type="submit" size="sm" variant="secondary">Add</Button>
            </form>
          </Section>
        );
      })}
    </Workspace>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}
