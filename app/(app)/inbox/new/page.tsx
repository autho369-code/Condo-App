import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { startStaffConversation } from '@/lib/rpcs/messages';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewConversationPage({
  searchParams,
}: { searchParams: Promise<{ owner?: string; tenant?: string; error?: string }> }) {
  await requireWorkspaceStaff();
  const sp = await searchParams;
  const ownerId = sp.owner && UUID.test(sp.owner) ? sp.owner : null;
  const tenantId = !ownerId && sp.tenant && UUID.test(sp.tenant) ? sp.tenant : null;
  if (!ownerId && !tenantId) notFound();
  const db = (await createClient()) as any;
  const { data: person } = ownerId
    ? await db.from('owners').select('id, full_name, email').eq('id', ownerId).maybeSingle()
    : await db.from('tenants').select('id, first_name, last_name, email').eq('id', tenantId).maybeSingle();
  if (!person) notFound();
  const name = ownerId ? person.full_name ?? 'Owner' : `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Tenant';

  // An owner can own several units (possibly in different associations): staff pick which one this is about.
  let units: { id: string; label: string }[] = [];
  if (ownerId) {
    const [{ data: occ }, { data: legacy }] = await Promise.all([
      db.from('occupancies').select('unit_id').eq('owner_id', ownerId).eq('status', 'current').eq('occupancy_type', 'owner'),
      db.from('unit_owners').select('unit_id').eq('owner_id', ownerId).is('end_date', null),
    ]);
    const ids = [...new Set([...(occ ?? []), ...(legacy ?? [])].map((r: any) => r.unit_id).filter(Boolean))];
    if (ids.length) {
      const { data: unitRows } = await db.from('units').select('id, unit_number, buildings(associations(name))').in('id', ids);
      units = ((unitRows ?? []) as any[]).map((u) => {
        const b = Array.isArray(u.buildings) ? u.buildings[0] : u.buildings;
        const a = Array.isArray(b?.associations) ? b.associations[0] : b?.associations;
        return { id: u.id, label: `${a?.name ? `${a.name} · ` : ''}Unit ${u.unit_number ?? '—'}` };
      }).sort((x, y) => x.label.localeCompare(y.label));
    }
  }

  return (
    <Workspace header={<WorkspaceHeader eyebrow={<Link href="/inbox" className="transition-colors hover:text-gray-700">Inbox</Link>} title={`Message ${name}`} />}>
      {sp.error ? <Alert className="mb-6">{sp.error}</Alert> : null}
      {!person.email ? <Alert tone="warning" className="mb-6">No email on file — {name} will only see this in their portal.</Alert> : null}
      <Section title="New conversation" subtitle="They get it by email and can reply from their portal.">
        <form action={startStaffConversation} className="space-y-4 px-5 py-4">
          {ownerId ? <input type="hidden" name="owner_id" value={ownerId} /> : <input type="hidden" name="tenant_id" value={tenantId!} />}
          {units.length > 1 ? (
            <div>
              <Label htmlFor="unit_id">About which unit?</Label>
              <select id="unit_id" name="unit_id" required defaultValue=""
                className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="" disabled>Pick a unit…</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
          ) : units.length === 1 ? <input type="hidden" name="unit_id" value={units[0].id} /> : null}
          <div><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" required maxLength={150} /></div>
          <div><Label htmlFor="body">Message</Label><Textarea id="body" name="body" required maxLength={5000} rows={8} /></div>
          <div className="flex justify-end gap-2">
            <Link href={ownerId ? `/owners/${ownerId}` : '/inbox'}><Button type="button" variant="secondary">Cancel</Button></Link>
            <Button type="submit">Send</Button>
          </div>
        </form>
      </Section>
    </Workspace>
  );
}
