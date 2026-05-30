import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { confirmOwnerInvitation } from '@/lib/people/owner-actions';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OwnerActivationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; owner?: string; error?: string; ok?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const [{ data: owners }, { data: invitations }] = await Promise.all([
    (supabase as any)
      .from('owners')
      .select('id, full_name, email, portal_activated, portal_login_last_at, archived_at, unit_id, units!inner(unit_number, buildings(name, associations(name)))')
      .is('archived_at', null)
      .order('full_name'),
    (supabase as any)
      .from('user_invitations')
      .select('id, email, full_name, status, created_at, expires_at, metadata')
      .eq('role', 'homeowner')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const invitationByEmail = new Map<string, any>();
  for (const invitation of invitations ?? []) {
    const email = (invitation as any).email?.toLowerCase();
    if (email && !invitationByEmail.has(email)) invitationByEmail.set(email, invitation);
  }

  let rows: any[] = (owners ?? []).map((owner: any) => ({
    owner,
    invitation: invitationByEmail.get(owner.email?.toLowerCase()),
  }));

  if (sp.owner) rows = rows.filter((row) => row.owner.id === sp.owner);
  if (q) {
    rows = rows.filter((row) =>
      [row.owner.full_name, row.owner.email, row.invitation?.status].some((value) => value?.toLowerCase().includes(q)),
    );
  }

  const active = (owners ?? []).filter((owner: any) => owner.portal_activated).length;
  const pending = (invitations ?? []).filter((invitation: any) => invitation.status === 'staged' || invitation.status === 'sent').length;
  const staged = (invitations ?? []).filter((invitation: any) => invitation.status === 'staged').length;

  return (
    <DataWorkspace
      title="Owner Portal Activation"
      description="Monitor portal readiness, invitation status, and last login before sending activation links."
      actions={<Link href="/owners/forms?template=portal_activation" className="inline-flex h-10 items-center rounded-md bg-gray-950 px-4 text-sm font-medium text-white">Prepare activation</Link>}
      rail={
        <div className="space-y-3 text-sm">
          {sp.ok && <div className="rounded border border-green-200 bg-green-50 p-3 text-xs text-green-800">Invitation processed successfully.</div>}
          {sp.error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">{sp.error}</div>}
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {staged} invitation{staged !== 1 ? 's' : ''} staged for review. Use the confirm button to send.
          </div>
          <Link href="/reports?slug=owner-directory" className="block rounded border border-gray-200 p-3 hover:bg-gray-50">Owner directory report</Link>
        </div>
      }
    >
      <div className="space-y-4">
        <MetricStrip
          metrics={[
            { label: 'Owners', value: owners?.length ?? 0 },
            { label: 'Portal active', value: active },
            { label: 'Pending invites', value: pending },
            { label: 'Needs activation', value: Math.max((owners?.length ?? 0) - active, 0) },
          ]}
        />
        <FilterBar action="/owners/activations" searchDefault={sp.q ?? ''} searchPlaceholder="Search owner, email, or invite status" />
        <Table>
          <THead>
            <TR>
              <TH>Owner</TH>
              <TH>Property</TH>
              <TH>Portal</TH>
              <TH>Latest Invitation</TH>
              <TH>Last Login</TH>
              <TH>Action</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map(({ owner, invitation }) => (
              <TR key={owner.id} className="hover:bg-gray-50">
                <TD>
                  <div className="font-medium text-blue-700">{owner.full_name}</div>
                  <div className="mt-1 text-xs text-gray-500">{owner.email}</div>
                </TD>
                <TD className="text-xs text-gray-500">
                  {(owner as any).units?.unit_number && (
                    <span>Unit {(owner as any).units.unit_number}{' '}
                      — {(owner as any).units.buildings?.name || ''}</span>
                  )}
                </TD>
                <TD><StatusChip tone={owner.portal_activated ? 'success' : 'warning'}>{owner.portal_activated ? 'Active' : 'Needs invite'}</StatusChip></TD>
                <TD>
                  {invitation ? (
                    <>
                      <div className="capitalize text-gray-900">{invitation.status?.replace(/_/g, ' ') ?? 'Sent'}</div>
                      <div className="mt-1 text-xs text-gray-500">Created {date(invitation.created_at)}</div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">No invitation</span>
                  )}
                </TD>
                <TD>{owner.portal_login_last_at ? date(owner.portal_login_last_at) : 'Never'}</TD>
                <TD>
                  <div className="flex gap-2">
                    {/* Stage new activation */}
                    <Link href={`/owners/forms?owner=${owner.id}&template=portal_activation`} className="text-sm font-medium text-blue-700 hover:underline">
                      Stage
                    </Link>
                    {/* Confirm staged invitation */}
                    {invitation && invitation.status === 'staged' && (
                      <form action={confirmOwnerInvitation} className="inline">
                        <input type="hidden" name="invitation_id" value={invitation.id} />
                        <button type="submit" className="text-sm font-medium text-green-700 hover:underline">Confirm send</button>
                      </form>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
