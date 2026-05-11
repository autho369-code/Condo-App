import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OwnerActivationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; owner?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const [{ data: owners }, { data: invitations }] = await Promise.all([
    (supabase as any)
      .from('owners')
      .select('id, full_name, email, portal_activated, portal_login_last_at, archived_at')
      .is('archived_at', null)
      .order('full_name'),
    (supabase as any)
      .from('user_invitations')
      .select('id, email, full_name, status, created_at, expires_at, used_at, message')
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
  const pending = (invitations ?? []).filter((invitation: any) => invitation.status === 'pending').length;

  return (
    <DataWorkspace
      title="Owner Portal Activation"
      description="Monitor portal readiness, invitation status, and last login before sending activation links."
      actions={<Link href="/owners/forms?template=portal_activation" className="inline-flex h-10 items-center rounded-md bg-gray-950 px-4 text-sm font-medium text-white">Prepare activation</Link>}
      rail={
        <div className="space-y-3 text-sm">
          <div className="rounded border border-amber-200 bg-champagne-50 p-3 text-xs text-amber-800">
            Sending activation links is confirmation-gated. Use the prepare action to stage recipients and message copy.
          </div>
          <Link href="/reports?slug=owner-directory" className="block rounded border border-ink-100 p-3 hover:bg-cream-50">Owner directory report</Link>
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
              <TH>Portal</TH>
              <TH>Latest Invitation</TH>
              <TH>Last Login</TH>
              <TH>Action</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map(({ owner, invitation }) => (
              <TR key={owner.id} className="hover:bg-cream-50">
                <TD>
                  <Link href={`/owners/${owner.id}`} className="font-medium text-champagne-700 hover:underline">{owner.full_name}</Link>
                  <div className="mt-1 text-xs text-ink-500">{owner.email}</div>
                </TD>
                <TD><StatusChip tone={owner.portal_activated ? 'success' : 'warning'}>{owner.portal_activated ? 'Active' : 'Needs invite'}</StatusChip></TD>
                <TD>
                  <div className="capitalize text-ink-900">{invitation?.status?.replace(/_/g, ' ') ?? 'No invitation'}</div>
                  <div className="mt-1 text-xs text-ink-500">Created {date(invitation?.created_at)} - Expires {date(invitation?.expires_at)}</div>
                </TD>
                <TD>{date(owner.portal_login_last_at)}</TD>
                <TD>
                  <Link href={`/owners/forms?owner=${owner.id}&template=portal_activation`} className="text-sm font-medium text-champagne-700 hover:underline">
                    Stage activation
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
