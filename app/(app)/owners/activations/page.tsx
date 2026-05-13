import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import {
  getOwnerPortalStatus,
  ownerPortalStatusLabel,
  ownerPortalStatusTone,
  sendOwnerPortalInvite,
  sendOwnerPortalPasswordReset,
} from '@/lib/auth/owner-portal';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OwnerActivationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    owner?: string;
    portal_invite_sent?: string;
    portal_reset_sent?: string;
    portal_error?: string;
  }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const [{ data: owners }, { data: invitations }] = await Promise.all([
    (supabase as any)
      .from('owners')
      .select('id, full_name, email, auth_user_id, portal_activated, portal_login_last_at, archived_at, portfolio_id')
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

  const statusCounts = (owners ?? []).reduce(
    (acc: Record<string, number>, owner: any) => {
      acc[getOwnerPortalStatus(owner)] = (acc[getOwnerPortalStatus(owner)] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const active = statusCounts.active ?? 0;
  const invited = statusCounts.invited ?? 0;
  const missingEmail = statusCounts.missing_email ?? 0;
  const pending = (invitations ?? []).filter((invitation: any) => invitation.status === 'pending').length;
  const resultMessage = sp.portal_error
    ? { tone: 'danger' as const, text: sp.portal_error }
    : sp.portal_invite_sent
      ? { tone: 'success' as const, text: `Invitation sent to ${sp.portal_invite_sent}.` }
      : sp.portal_reset_sent
        ? { tone: 'success' as const, text: `Password setup link sent to ${sp.portal_reset_sent}.` }
        : null;

  return (
    <DataWorkspace
      title="Owner Portal Invites"
      description="Send owner sign-up links, let owners choose their own password, and resend reset links when needed."
      actions={<Link href="/owners" className="inline-flex h-10 items-center rounded-md bg-gray-950 px-4 text-sm font-medium text-white">Owner directory</Link>}
      rail={
        <div className="space-y-3 text-sm">
          <div className="rounded border border-ink-100 bg-white p-3 text-xs text-ink-600">
            Invite sends a Supabase sign-up email. Reset sends a password setup link to owners already connected to the portal.
          </div>
          <Link href="/reports?slug=owner-directory" className="block rounded border border-ink-100 p-3 hover:bg-cream-50">Owner directory report</Link>
        </div>
      }
    >
      <div className="space-y-4">
        {resultMessage && (
          <div className={`rounded border px-4 py-3 text-sm ${resultMessage.tone === 'danger' ? 'border-bordeaux-200 bg-bordeaux-50 text-bordeaux-700' : 'border-sage-200 bg-sage-50 text-sage-700'}`}>
            {resultMessage.text}
          </div>
        )}
        <MetricStrip
          metrics={[
            { label: 'Owners', value: owners?.length ?? 0 },
            { label: 'Portal active', value: active },
            { label: 'Invited', value: invited || pending },
            { label: 'Needs invite', value: statusCounts.needs_invite ?? 0 },
            { label: 'Missing email', value: missingEmail },
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
            {rows.map(({ owner, invitation }) => {
              const status = getOwnerPortalStatus(owner);
              return (
                <TR key={owner.id} className="hover:bg-cream-50">
                  <TD>
                    <Link href={`/owners/${owner.id}`} className="font-medium text-champagne-700 hover:underline">{owner.full_name}</Link>
                    <div className="mt-1 text-xs text-ink-500">{owner.email ?? 'No email on file'}</div>
                  </TD>
                  <TD><StatusChip tone={ownerPortalStatusTone(status)}>{ownerPortalStatusLabel(status)}</StatusChip></TD>
                  <TD>
                    <div className="capitalize text-ink-900">{invitation?.status?.replace(/_/g, ' ') ?? 'No invitation record'}</div>
                    <div className="mt-1 text-xs text-ink-500">Created {date(invitation?.created_at)} - Expires {date(invitation?.expires_at)}</div>
                  </TD>
                  <TD>{date(owner.portal_login_last_at)}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-2">
                      {status === 'missing_email' ? (
                        <Link href={`/owners/${owner.id}`} className="text-sm font-medium text-champagne-700 hover:underline">Add email</Link>
                      ) : status === 'needs_invite' ? (
                        <form action={sendOwnerPortalInvite.bind(null, owner.id, '/owners/activations') as any}>
                          <Button type="submit" size="sm">Send invite</Button>
                        </form>
                      ) : (
                        <form action={sendOwnerPortalPasswordReset.bind(null, owner.id, '/owners/activations') as any}>
                          <Button type="submit" size="sm" variant="secondary">{status === 'active' ? 'Send reset' : 'Resend setup'}</Button>
                        </form>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
