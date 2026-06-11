import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function CommitteesTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations').select('id, name').eq('id', id).maybeSingle();
  if (aErr || !assoc) notFound();

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
            actions={<Button size="sm" disabled>+ New Committee</Button>}
          />
        </>
      }
      rail={rail}
    >
      {(!committees || committees.length === 0) ? (
        <Section padded>
          <p className="text-center text-sm italic text-gray-500">
            No committees yet. Create one to get started.
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
                </tr>
              </thead>
              <tbody>
                {activeMembers.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No members on this committee.</td></tr>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        );
      })}
    </Workspace>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}
