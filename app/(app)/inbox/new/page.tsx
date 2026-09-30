import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
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
  await requireStaff();
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

  return (
    <Workspace header={<WorkspaceHeader eyebrow={<Link href="/inbox" className="transition-colors hover:text-gray-700">Inbox</Link>} title={`Message ${name}`} />}>
      {sp.error ? <Alert className="mb-6">{sp.error}</Alert> : null}
      {!person.email ? <Alert tone="warning" className="mb-6">No email on file — {name} will only see this in their portal.</Alert> : null}
      <Section title="New conversation" subtitle="They get it by email and can reply from their portal.">
        <form action={startStaffConversation} className="space-y-4 px-5 py-4">
          {ownerId ? <input type="hidden" name="owner_id" value={ownerId} /> : <input type="hidden" name="tenant_id" value={tenantId!} />}
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
