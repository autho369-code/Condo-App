import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { sendPortalActivation } from '@/lib/people/owner-workflow-actions';

export const dynamic = 'force-dynamic';

export default async function OwnerActivationsPage({ searchParams }: { searchParams: Promise<{ q?: string; owner?: string; ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: owners }, { data: invites }] = await Promise.all([
    db.from('owners').select('id, full_name, email, portal_activated, portal_login_last_at, archived_at').is('archived_at', null).order('full_name'),
    db.from('owner_portal_invites').select('id, owner_id, status, sent_at, activated_at, last_login_at').order('sent_at', { ascending: false }),
  ]);

  const inviteByOwner = new Map();
  for (const inv of (invites ?? [])) {
    if (!inviteByOwner.has(inv.owner_id)) inviteByOwner.set(inv.owner_id, inv);
  }

  let rows = (owners ?? []).map((o: any) => ({ owner: o, invite: inviteByOwner.get(o.id) || null }));
  if (sp.owner) rows = rows.filter((r: any) => r.owner.id === sp.owner);
  if (q) rows = rows.filter((r: any) => [r.owner.full_name, r.owner.email].some((v: string) => v?.toLowerCase().includes(q)));

  const active = rows.filter((r: any) => r.invite?.status === 'active').length;
  const sent = rows.filter((r: any) => r.invite?.status === 'sent').length;
  const notInvited = rows.filter((r: any) => !r.invite || r.invite.status === 'not_invited').length;

  return (
    <DataWorkspace
      title="Portal Activation"
      description="Send secure portal invite emails to owners. Track activation status, last sent date, and last login."
      actions={<Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to owners</Link>}
      rail={
        <div className="space-y-2">
          {sp.ok && <div className="rounded border border-green-200 bg-green-50 p-3 text-xs text-green-800">{sp.ok}</div>}
          {sp.error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">{sp.error}</div>}
        </div>
      }
    >
      <div className="space-y-4">
        <MetricStrip metrics={[
          { label: 'Owners', value: rows.length },
          { label: 'Active', value: active },
          { label: 'Invite Sent', value: sent },
          { label: 'Not Invited', value: notInvited },
        ]} />
        <FilterBar action="/owners/activations" searchDefault={sp.q ?? ''} searchPlaceholder="Search owner or email" />
        <Table>
          <THead><TR><TH>Owner</TH><TH>Status</TH><TH>Last Sent</TH><TH>Last Login</TH><TH>Action</TH></TR></THead>
          <tbody>
            {rows.map(({ owner, invite }: any) => (
              <TR key={owner.id}>
                <TD>
                  <Link href={`/owners/${owner.id}`} className="font-medium text-blue-700 hover:underline">{owner.full_name}</Link>
                  <div className="mt-1 text-xs text-slate-400">{owner.email}</div>
                </TD>
                <TD>
                  <StatusChip tone={invite?.status === 'active' ? 'success' : invite?.status === 'sent' ? 'info' : 'neutral'}>
                    {invite?.status?.replace(/_/g, ' ') ?? 'Not invited'}
                  </StatusChip>
                </TD>
                <TD className="text-sm text-slate-400">{invite?.sent_at ? new Date(invite.sent_at).toLocaleDateString() : '—'}</TD>
                <TD className="text-sm text-slate-400">{invite?.last_login_at ? new Date(invite.last_login_at).toLocaleDateString() : '—'}</TD>
                <TD>
                  <form action={sendPortalActivation}>
                    <input type="hidden" name="owner_id" value={owner.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      {invite?.status === 'sent' || invite?.status === 'active' ? 'Resend' : 'Activate'}
                    </Button>
                  </form>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
