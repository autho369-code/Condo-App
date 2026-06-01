import { revalidatePath } from 'next/cache';
import Link from 'next/link';

import { Workspace, WorkspaceHeader } from '@/components/workspace/shell';
import { Card, CardBody, Stat } from '@/components/ui/card';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { Search, Key, UserX, ShieldCheck, Users, Building2, Filter } from 'lucide-react';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// Server Actions
// ──────────────────────────────────────────────

async function resetUserPassword(formData: FormData) {
  'use server';
  const email = formData.get('email') as string;
  const serviceClient = await createServiceClient();
  const { error } = await serviceClient.auth.admin.generateLink({
    type: 'recovery',
    email,
  });
  if (error) {
    console.error('Failed to send password reset:', error.message);
  }
  revalidatePath('/platform/users');
}

async function toggleUserDisabled(formData: FormData) {
  'use server';
  const profileId = formData.get('profile_id') as string;
  const disable = formData.get('disable') === '1';
  const supabase = await createClient();
  if (disable) {
    await (supabase as any)
      .from('profiles')
      .update({ disabled_at: new Date().toISOString() })
      .eq('id', profileId);
  } else {
    await (supabase as any)
      .from('profiles')
      .update({ disabled_at: null })
      .eq('id', profileId);
  }
  revalidatePath('/platform/users');
}

async function changeUserRole(formData: FormData) {
  'use server';
  const profileId = formData.get('profile_id') as string;
  const role = formData.get('role') as string;
  if (!role) return;
  const supabase = await createClient();
  await (supabase as any)
    .from('profiles')
    .update({ hoa_role: role })
    .eq('id', profileId);
  revalidatePath('/platform/users');
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const ROLE_OPTIONS = [
  'owner',
  'admin',
  'manager',
  'staff',
  'finance',
  'board_member',
  'resident',
  'vendor',
  'readonly',
] as const;

function getInviteStatus(invite: any): { label: string; tone: Tone } {
  if (!invite) return { label: 'No invite', tone: 'neutral' };
  const status = invite.status;
  if (status === 'accepted') return { label: 'Accepted', tone: 'success' };
  if (status === 'pending') {
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { label: 'Expired', tone: 'danger' };
    }
    return { label: 'Pending', tone: 'warning' };
  }
  if (status === 'expired' || status === 'revoked') return { label: 'Expired', tone: 'danger' };
  return { label: status ?? 'Unknown', tone: 'neutral' };
}

function getUserStatus(profile: any, invite: any): { label: string; tone: Tone } {
  if (profile.disabled_at) return { label: 'Disabled', tone: 'danger' };
  if (profile.last_login_at) return { label: 'Active', tone: 'success' };
  if (invite?.status === 'pending') return { label: 'Invited', tone: 'warning' };
  return { label: 'No Access', tone: 'neutral' };
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; company?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.q || '';
  const roleFilter = sp.role || '';
  const companyFilter = sp.company || '';

  const supabase = await createClient();

  // Fetch all data in parallel
  const [
    { data: profiles },
    { data: portfolios },
    { data: invitations },
    { data: assocManagers },
    { data: boardMembers },
  ] = await Promise.all([
    (supabase as any)
      .from('profiles')
      .select(
        'id, email, full_name, display_name, hoa_role, portfolio_id, role_id, last_login_at, mfa_required, mfa_enrolled_at, disabled_at, created_at',
      )
      .order('full_name')
      .limit(500),
    (supabase as any)
      .from('portfolios')
      .select('id, company_name')
      .is('archived_at', null)
      .order('company_name'),
    (supabase as any)
      .from('user_invitations')
      .select('email, portfolio_id, status, expires_at'),
    (supabase as any)
      .from('association_managers')
      .select('profile_id, associations!inner(name)'),
    (supabase as any)
      .from('board_members')
      .select('profile_id, associations!inner(name)'),
  ]);

  // ── Build lookup maps ──────────────────────

  const portfolioById = new Map<string, string>(
    (portfolios ?? []).map((p: any) => [p.id, p.company_name]),
  );

  // Invite — first match by email wins
  const inviteByEmail = new Map<string, any>();
  for (const inv of invitations ?? []) {
    if (!inviteByEmail.has(inv.email)) {
      inviteByEmail.set(inv.email, inv);
    }
  }

  // Association links (manager + board combined)
  const assocByProfile = new Map<string, string>();
  for (const am of assocManagers ?? []) {
    if (am.associations?.name && !assocByProfile.has(am.profile_id)) {
      assocByProfile.set(am.profile_id, am.associations.name);
    }
  }
  for (const bm of boardMembers ?? []) {
    if (bm.associations?.name && !assocByProfile.has(bm.profile_id)) {
      assocByProfile.set(bm.profile_id, bm.associations.name);
    }
  }

  // ── Extract filter options ─────────────────

  const roles = [
    ...new Set(
      (profiles ?? [])
        .map((p: any) => p.hoa_role)
        .filter(Boolean)
        .sort(),
    ),
  ] as string[];

  const companies = [
    ...new Set((portfolios ?? []).map((p: any) => p.company_name).filter(Boolean).sort()),
  ] as string[];

  // ── Filter profiles ────────────────────────

  let filtered = profiles ?? [];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p: any) =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q),
    );
  }
  if (roleFilter) {
    filtered = filtered.filter((p: any) => p.hoa_role === roleFilter);
  }
  if (companyFilter) {
    filtered = filtered.filter((p: any) => {
      const name = portfolioById.get(p.portfolio_id);
      return name === companyFilter;
    });
  }

  // ── Stats ──────────────────────────────────

  const totalProfiles = (profiles ?? []).length;
  const activeCount = (profiles ?? []).filter((p: any) => p.last_login_at && !p.disabled_at).length;
  const disabledCount = (profiles ?? []).filter((p: any) => p.disabled_at).length;
  const pendingInvites = (invitations ?? []).filter((i: any) => i.status === 'pending').length;

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow="Access Control"
          title="Users & Permissions"
          subtitle="Manage staff, admins, and board members across all management companies. Reset passwords, change roles, and control access."
        />
      }
    >
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total Users" value={totalProfiles} sub="All profiles" />
        <Stat label="Active" value={activeCount} sub="Have logged in" />
        <Stat label="Disabled" value={disabledCount} sub="Access revoked" />
        <Stat label="Pending Invites" value={pendingInvites} sub="Awaiting acceptance" />
      </div>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="min-w-64 flex-1 text-xs font-medium uppercase tracking-wide text-gray-500">
          <span className="mb-1 flex items-center gap-1.5">
            <Search className="h-3 w-3" />
            Search
          </span>
          <input
            name="q"
            defaultValue={search}
            placeholder="Name or email…"
            className="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm normal-case text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          <span className="mb-1 flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Role
          </span>
          <select
            name="role"
            defaultValue={roleFilter}
            className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          <span className="mb-1 flex items-center gap-1.5">
            <Building2 className="h-3 w-3" />
            Company
          </span>
          <select
            name="company"
            defaultValue={companyFilter}
            className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded bg-gray-950 px-4 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Filter className="h-3.5 w-3.5" />
          Apply
        </button>

        {(search || roleFilter || companyFilter) && (
          <a
            href="/platform/users"
            className="inline-flex h-9 items-center text-xs text-gray-500 hover:text-gray-700"
          >
            Clear all
          </a>
        )}
      </form>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardBody>
            <div className="py-12 text-center">
              <Users className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                {search || roleFilter || companyFilter
                  ? 'No users match your filters.'
                  : 'No users are visible.'}
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Company</TH>
                  <TH>Association</TH>
                  <TH>Status</TH>
                  <TH>Last Login</TH>
                  <TH>MFA</TH>
                  <TH>Invite</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {filtered.map((user: any) => {
                  const invite = inviteByEmail.get(user.email);
                  const inviteStatus = getInviteStatus(invite);
                  const userStatus = getUserStatus(user, invite);
                  const companyName =
                    user.portfolio_id
                      ? portfolioById.get(user.portfolio_id) ?? '—'
                      : '—';
                  const associationName = assocByProfile.get(user.id) ?? '—';

                  return (
                    <TR key={user.id} className="hover:bg-gray-50">
                      {/* Name */}
                      <TD>
                        <div className="font-medium text-gray-950">
                          {user.full_name ?? user.display_name ?? user.email ?? 'Unnamed'}
                        </div>
                      </TD>

                      {/* Email */}
                      <TD>
                        <span className="text-sm text-gray-600">{user.email ?? '—'}</span>
                      </TD>

                      {/* Role */}
                      <TD>
                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
                          {(user.hoa_role ?? 'none').replace(/_/g, ' ')}
                        </span>
                      </TD>

                      {/* Company */}
                      <TD>
                        {user.portfolio_id ? (
                          <Link
                            href={`/platform/portfolios/${user.portfolio_id}`}
                            className="text-blue-700 hover:underline"
                          >
                            {companyName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">Platform</span>
                        )}
                      </TD>

                      {/* Association */}
                      <TD className="text-sm text-gray-600">{associationName}</TD>

                      {/* Status */}
                      <TD>
                        <StatusChip tone={userStatus.tone}>{userStatus.label}</StatusChip>
                      </TD>

                      {/* Last Login */}
                      <TD className="text-sm tabular-nums text-gray-600">
                        {date(user.last_login_at)}
                      </TD>

                      {/* MFA */}
                      <TD>
                        {user.mfa_enrolled_at ? (
                          <StatusChip tone="success">Enabled</StatusChip>
                        ) : user.mfa_required ? (
                          <StatusChip tone="warning">Required</StatusChip>
                        ) : (
                          <StatusChip tone="neutral">Optional</StatusChip>
                        )}
                      </TD>

                      {/* Invite */}
                      <TD>
                        <StatusChip tone={inviteStatus.tone}>{inviteStatus.label}</StatusChip>
                      </TD>

                      {/* Actions */}
                      <TD>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Force password reset */}
                          <form action={resetUserPassword}>
                            <input type="hidden" name="email" value={user.email ?? ''} />
                            <button
                              type="submit"
                              title="Force password reset"
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-amber-600"
                              disabled={!user.email}
                            >
                              <Key className="h-3.5 w-3.5" />
                            </button>
                          </form>

                          {/* Disable / Enable toggle */}
                          <form action={toggleUserDisabled}>
                            <input type="hidden" name="profile_id" value={user.id} />
                            <input
                              type="hidden"
                              name="disable"
                              value={user.disabled_at ? '0' : '1'}
                            />
                            <button
                              type="submit"
                              title={user.disabled_at ? 'Enable user' : 'Disable user'}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 ${
                                user.disabled_at
                                  ? 'text-emerald-500 hover:text-emerald-700'
                                  : 'text-gray-400 hover:text-red-600'
                              }`}
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          </form>

                          {/* Change role dropdown */}
                          <form action={changeUserRole} className="flex items-center gap-1">
                            <input type="hidden" name="profile_id" value={user.id} />
                            <select
                              name="role"
                              defaultValue={user.hoa_role ?? ''}
                              className="h-7 rounded border border-gray-200 bg-white px-1.5 text-xs text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            >
                              <option value="" disabled>
                                Change role…
                              </option>
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r} value={r}>
                                  {r.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </select>
                          </form>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>

            {/* Row count */}
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
              Showing {filtered.length} of {totalProfiles} user{totalProfiles !== 1 ? 's' : ''}
              {(search || roleFilter || companyFilter) && ' (filtered)'}
            </div>
          </CardBody>
        </Card>
      )}
    </Workspace>
  );
}
