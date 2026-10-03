import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { SUBMISSION_FIELD, newSubmissionToken } from '@/lib/forms/submission';
import { sendOwnerPortalInvitations } from '@/lib/rpcs/owner-invitations';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

type Status = 'active' | 'account' | 'invited' | 'expired' | 'not_invited' | 'no_email';

const STATUS: Record<Status, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  active: { label: 'Active', tone: 'success' },
  account: { label: 'Account created, access off', tone: 'neutral' },
  invited: { label: 'Invited', tone: 'info' },
  expired: { label: 'Invitation expired', tone: 'warning' },
  not_invited: { label: 'Not invited', tone: 'warning' },
  no_email: { label: 'No email', tone: 'danger' },
};

/** Statuses that can be sent an invitation (a first one or a new one). */
const INVITABLE: Status[] = ['not_invited', 'expired', 'invited'];
/** Filter value for every owner not yet using the portal (has an email or an account). */
const INACTIVE: Status[] = ['account', 'invited', 'expired', 'not_invited'];

export default async function OwnerActivationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; owner?: string; status?: string; association?: string; sent?: string; skipped?: string; failed?: string; remaining?: string; error?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const statusFilter: Status | 'inactive' | '' = sp.status === 'inactive' ? 'inactive' : (Object.keys(STATUS) as Status[]).includes(sp.status as Status) ? (sp.status as Status) : '';
  const association = UUID.test(sp.association ?? '') ? sp.association! : '';
  const db = (await createClient()) as any;

  const [owners, invitations, occupancies, associations] = await Promise.all([
    fetchAllRows<any>(() => db.from('owners')
      .select('id, full_name, email, portal_activated, auth_user_id, portal_login_last_at')
      .is('archived_at', null)
      .order('full_name')
      .order('id'), { maxRows: 20000 }),
    fetchAllRows<any>(() => db.from('user_invitations')
      .select('id, email, status, created_at, expires_at, accepted_at')
      .eq('hoa_role', 'owner')
      .order('created_at', { ascending: false })
      .order('id'), { maxRows: 50000 }),
    // Current homeowners' units, for the association filter and the Units column.
    fetchAllRows<any>(() => db.from('occupancies')
      .select('id, owner_id, association_id, units(unit_number)')
      .eq('status', 'current')
      .eq('occupancy_type', 'owner')
      .order('id'), { maxRows: 50000 }),
    fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id')),
  ]);
  const loadError = owners.error ?? invitations.error ?? occupancies.error ?? associations.error;
  const partial = owners.truncated || invitations.truncated || occupancies.truncated;

  // Newest invitation per email (the list is newest first).
  const latestInvite = new Map<string, any>();
  for (const inv of invitations.rows) {
    const email = String(inv.email ?? '').toLowerCase();
    if (email && !latestInvite.has(email)) latestInvite.set(email, inv);
  }
  const unitsByOwner = new Map<string, { units: string[]; associations: Set<string> }>();
  for (const occ of occupancies.rows) {
    const entry = unitsByOwner.get(occ.owner_id) ?? { units: [], associations: new Set<string>() };
    if (occ.units?.unit_number) entry.units.push(occ.units.unit_number);
    if (occ.association_id) entry.associations.add(occ.association_id);
    unitsByOwner.set(occ.owner_id, entry);
  }

  const now = Date.now();
  const all = owners.rows.map((owner) => {
    const email = String(owner.email ?? '').trim().toLowerCase();
    const invitation = email ? latestInvite.get(email) : undefined;
    let status: Status;
    if (owner.portal_activated) status = 'active';
    else if (owner.auth_user_id) status = 'account';
    else if (!EMAIL.test(email)) status = 'no_email';
    else if (invitation?.status === 'pending' && new Date(invitation.expires_at).getTime() > now) status = 'invited';
    else if (invitation && (invitation.status === 'expired' || invitation.status === 'pending')) status = 'expired';
    else status = 'not_invited';
    return { owner, invitation, status, homes: unitsByOwner.get(owner.id) };
  });

  const rows = all.filter((r) =>
    (!sp.owner || r.owner.id === sp.owner) &&
    (!statusFilter || (statusFilter === 'inactive' ? INACTIVE.includes(r.status) : r.status === statusFilter)) &&
    (!association || r.homes?.associations.has(association)) &&
    (!q || [r.owner.full_name, r.owner.email].some((v) => String(v ?? '').toLowerCase().includes(q))));

  const count = (s: Status) => all.filter((r) => r.status === s).length;
  const invitable = rows.filter((r) => INVITABLE.includes(r.status));
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ q: sp.q ?? '', status: statusFilter, association, owner: sp.owner ?? '' })) if (v) params.set(k, v);
  const returnTo = params.toString() ? `/owners/activations?${params}` : '/owners/activations';

  return (
    <DataWorkspace
      title="Owner Portal Activation"
      description="See which homeowners use the owner portal, and invite the ones who don't yet. Each owner chooses their own password from the invitation link."
    >
      <div className="space-y-4">
        {loadError && <Alert tone="danger" title="Could not load every owner">{loadError}</Alert>}
        {partial && <Alert tone="warning" title="List is incomplete">There are more owners or invitations than this page can load.</Alert>}
        {sp.error && <Alert tone="danger" title="Could not send invitations">{sp.error}</Alert>}
        {sp.sent && (
          <Alert tone="success" title={`${sp.sent} invitation${sp.sent === '1' ? '' : 's'} sent`}>
            {sp.skipped ? `${sp.skipped} skipped (already active, has an account, or no valid email). ` : ''}
            Each owner gets an email with a private link that expires in 30 days.
            {sp.remaining ? ` ${sp.remaining} more were selected than one send handles (200): filter Status to “Not invited”, select all and send again.` : ''}
          </Alert>
        )}
        {sp.failed && <Alert tone="danger" title="Some invitations failed">{sp.failed}</Alert>}

        <MetricStrip
          metrics={[
            { label: 'Owners', value: all.length },
            { label: 'Portal active', value: count('active'), sublabel: all.length ? `${Math.round((count('active') / all.length) * 100)}% of owners` : undefined },
            { label: 'Invited, waiting', value: count('invited') },
            { label: 'Not invited or expired', value: count('not_invited') + count('expired') },
            { label: 'No email', value: count('no_email') },
          ]}
        />

        <FilterBar action="/owners/activations" searchDefault={sp.q ?? ''} searchPlaceholder="Search owner or email">
          <FilterSelect label="Status" name="status" defaultValue={statusFilter}>
            <option value="">All</option>
            <option value="inactive">Not activated (any)</option>
            {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </FilterSelect>
          <FilterSelect label="Association" name="association" defaultValue={association}>
            <option value="">All associations</option>
            {associations.rows.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        </FilterBar>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState title="No owners match this filter" description="Change the status or association filter." />
          </div>
        ) : (
          <form action={sendOwnerPortalInvitations} className="space-y-3">
            <input type="hidden" name="return_to" value={returnTo} />
            <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                {rows.length} owner{rows.length === 1 ? '' : 's'} shown · {invitable.length} can be invited. Tick owners, then send.
              </p>
              <PendingSubmit disabled={invitable.length === 0} pendingLabel="Sending…">Send invitations</PendingSubmit>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH className="w-10"><SelectAllCheckbox targetName="owner_id" defaultChecked={false} /></TH>
                  <TH>Owner</TH>
                  <TH>Units</TH>
                  <TH>Portal</TH>
                  <TH>Latest invitation</TH>
                  <TH>Last login</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map(({ owner, invitation, status, homes }) => {
                  const canInvite = INVITABLE.includes(status);
                  return (
                    <TR key={owner.id}>
                      <TD>
                        {canInvite && (
                          <input type="checkbox" name="owner_id" value={owner.id} aria-label={`Invite ${owner.full_name}`} className="h-4 w-4 rounded border-gray-300" />
                        )}
                      </TD>
                      <TD>
                        <Link href={`/owners/${owner.id}`} className="font-medium text-gray-900 hover:underline">{owner.full_name}</Link>
                        <div className="mt-0.5 text-xs text-gray-500">{owner.email || 'No email on file'}</div>
                      </TD>
                      <TD className="text-sm text-gray-600">{homes?.units.length ? homes.units.join(', ') : '—'}</TD>
                      <TD>
                        <StatusChip tone={STATUS[status].tone}>{STATUS[status].label}</StatusChip>
                        {status === 'account' && <div className="mt-1 text-xs text-gray-500"><Link href={`/owners/${owner.id}`} className="underline">Turn on access</Link> on the owner page.</div>}
                        {status === 'no_email' && <div className="mt-1 text-xs text-gray-500"><Link href={`/owners/${owner.id}`} className="underline">Add an email</Link> to invite.</div>}
                      </TD>
                      <TD className="text-sm text-gray-600">
                        {invitation ? (
                          <>
                            <div>Sent {date(invitation.created_at)}</div>
                            <div className="text-xs text-gray-500">
                              {invitation.status === 'accepted' ? `Accepted ${date(invitation.accepted_at)}` : invitation.status === 'revoked' ? 'Replaced or revoked' : `Expires ${date(invitation.expires_at)}`}
                            </div>
                          </>
                        ) : '—'}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(owner.portal_login_last_at)}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </form>
        )}
      </div>
    </DataWorkspace>
  );
}
