import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { Workspace, WorkspaceHeader } from '@/components/workspace/shell';
import { Card, CardBody, Stat } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { Search, Filter, Mail, RefreshCw, XCircle, Send, Building2, ShieldCheck, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const HOA_ROLES = [
  { value: 'company_admin', label: 'Company Admin' },
] as const;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'revoked', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
] as const;

function getStatusTone(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'pending':
      return { label: 'Pending', tone: 'warning' };
    case 'accepted':
      return { label: 'Accepted', tone: 'success' };
    case 'revoked':
      return { label: 'Cancelled', tone: 'neutral' };
    case 'expired':
      return { label: 'Expired', tone: 'danger' };
    default:
      return { label: status || 'Unknown', tone: 'neutral' };
  }
}

// ──────────────────────────────────────────────
// Server Actions
// ──────────────────────────────────────────────

async function sendInvitation(formData: FormData) {
  'use server';

  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const portfolioId = (formData.get('portfolio_id') as string)?.trim();
  const hoaRole = (formData.get('hoa_role') as string)?.trim();
  const message = (formData.get('message') as string)?.trim() || undefined;
  const expiresAt = (formData.get('expires_at') as string)?.trim();

  if (!email || !portfolioId || !hoaRole) {
    redirect('/platform/invitations?error=' + encodeURIComponent('Email, company, and role are required.'));
  }

  const supabase = await createClient();

  // Compute expires_days from the date picker value, default to 7 days
  let expiresDays = 7;
  if (expiresAt) {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    expiresDays = Math.max(1, days);
  }

  const { error } = await (supabase as any).rpc('create_invitation', {
    p_email: email,
    p_portfolio_id: portfolioId,
    p_hoa_role: hoaRole,
    p_message: message,
    p_expires_days: expiresDays,
  });

  if (error) {
    console.error('Failed to create invitation:', error.message);
    redirect('/platform/invitations?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/platform/invitations');
  redirect('/platform/invitations?ok=1');
}

async function resendInvitation(formData: FormData) {
  'use server';

  const invitationId = (formData.get('invitation_id') as string)?.trim();
  if (!invitationId) return;

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('resend_invitation', {
    p_invitation_id: invitationId,
  });

  if (error) {
    console.error('Failed to resend invitation:', error.message);
  }

  revalidatePath('/platform/invitations');
}

async function cancelInvitation(formData: FormData) {
  'use server';

  const invitationId = (formData.get('invitation_id') as string)?.trim();
  if (!invitationId) return;

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('revoke_invitation', {
    p_invitation_id: invitationId,
  });

  if (error) {
    console.error('Failed to cancel invitation:', error.message);
  }

  revalidatePath('/platform/invitations');
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default async function PlatformInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.q || '';
  const statusFilter = sp.status || '';
  const successMessage = sp.ok ? 'Invitation sent successfully.' : '';
  const errorMessage = sp.error || '';

  const supabase = await createClient();

  // Fetch invitations and portfolios in parallel
  const [{ data: invitations }, { data: portfolios }] = await Promise.all([
    (supabase as any)
      .from('user_invitations')
      .select('id, email, full_name, hoa_role, portfolio_id, status, created_at, expires_at, token, message, invited_by')
      .order('created_at', { ascending: false })
      .limit(500),
    (supabase as any)
      .from('portfolios')
      .select('id, company_name')
      .is('archived_at', null)
      .order('company_name'),
  ]);

  // Build portfolio lookup map
  const portfolioById = new Map<string, string>(
    (portfolios ?? []).map((p: any) => [p.id, p.company_name]),
  );

  // ── Stats ──────────────────────────────────

  const totalSent = (invitations ?? []).length;
  const pendingCount = (invitations ?? []).filter((i: any) => i.status === 'pending').length;
  const acceptedCount = (invitations ?? []).filter((i: any) => i.status === 'accepted').length;
  const expiredCount = (invitations ?? []).filter((i: any) => i.status === 'expired').length;
  const cancelledCount = (invitations ?? []).filter((i: any) => i.status === 'revoked').length;

  // ── Filter ────────────────────────────────

  let filtered = invitations ?? [];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (i: any) =>
        (i.email || '').toLowerCase().includes(q) ||
        (i.full_name || '').toLowerCase().includes(q),
    );
  }
  if (statusFilter) {
    filtered = filtered.filter((i: any) => i.status === statusFilter);
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow="Access Control"
          title="Invitations"
          subtitle="Create and manage invitations for staff, board members, owners, and tenants across all management companies."
        />
      }
    >
      {/* Toast messages */}
      {successMessage && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total Sent" value={totalSent} sub="All invitations" />
        <Stat label="Pending" value={pendingCount} sub="Awaiting response" />
        <Stat label="Accepted" value={acceptedCount} sub="Activated" />
        <Stat label="Expired" value={expiredCount} sub="Past deadline" />
        <Stat label="Cancelled" value={cancelledCount} sub="Manually revoked" />
      </div>

      {/* Create Invitation Form */}
      <Card className="mb-6">
        <CardBody>
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Create Invitation</h3>
          <form action={sendInvitation} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Email */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <Mail className="h-3 w-3" />
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="jane@company.com"
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Company (Portfolio) */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <Building2 className="h-3 w-3" />
                  Company
                </label>
                <select
                  name="portfolio_id"
                  required
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select company…</option>
                  {(portfolios ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <ShieldCheck className="h-3 w-3" />
                  Role
                </label>
                <select
                  name="hoa_role"
                  required
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select role…</option>
                  {HOA_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expiration Date */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <Clock className="h-3 w-3" />
                  Expiration Date
                </label>
                <input
                  name="expires_at"
                  type="date"
                  defaultValue={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .slice(0, 10)}
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Optional Message */}
            <div>
              <label className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                Message (optional)
              </label>
              <textarea
                name="message"
                rows={2}
                placeholder="Add a personal note to the invitation email…"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <Button type="submit" variant="default">
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Send Invitation
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="min-w-64 flex-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span className="mb-1 flex items-center gap-1.5">
            <Search className="h-3 w-3" />
            Search
          </span>
          <input
            name="q"
            defaultValue={search}
            placeholder="Email or name…"
            className="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm normal-case text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
          <span className="mb-1 flex items-center gap-1.5">
            <Filter className="h-3 w-3" />
            Status
          </span>
          <select
            name="status"
            defaultValue={statusFilter}
            className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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

        {(search || statusFilter) && (
          <a
            href="/platform/invitations"
            className="inline-flex h-9 items-center text-xs text-slate-400 hover:text-gray-700"
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
              <Mail className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm text-slate-400">
                {search || statusFilter
                  ? 'No invitations match your filters.'
                  : 'No invitations yet. Create one above.'}
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
                  <TH>Email</TH>
                  <TH>Full Name</TH>
                  <TH>Role</TH>
                  <TH>Company</TH>
                  <TH>Status</TH>
                  <TH>Sent Date</TH>
                  <TH>Expires</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {filtered.map((inv: any) => {
                  const status = getStatusTone(inv.status ?? '');
                  const companyName = portfolioById.get(inv.portfolio_id) ?? '—';

                  return (
                    <TR key={inv.id} className="hover:bg-gray-50">
                      {/* Email */}
                      <TD>
                        <span className="text-sm font-mono text-gray-900">{inv.email ?? '—'}</span>
                      </TD>

                      {/* Full Name */}
                      <TD>
                        <span className="text-sm text-gray-700">{inv.full_name ?? '—'}</span>
                      </TD>

                      {/* Role */}
                      <TD>
                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
                          {(inv.hoa_role ?? '—').replace(/_/g, ' ')}
                        </span>
                      </TD>

                      {/* Company */}
                      <TD className="text-sm text-slate-400">{companyName}</TD>

                      {/* Status */}
                      <TD>
                        <StatusChip tone={status.tone}>{status.label}</StatusChip>
                      </TD>

                      {/* Sent Date */}
                      <TD className="text-sm tabular-nums text-slate-400">
                        {date(inv.created_at)}
                      </TD>

                      {/* Expires */}
                      <TD className="text-sm tabular-nums text-slate-400">
                        {date(inv.expires_at)}
                      </TD>

                      {/* Actions */}
                      <TD>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Resend — only for pending/expired */}
                          {(inv.status === 'pending' || inv.status === 'expired') && (
                            <form action={resendInvitation}>
                              <input type="hidden" name="invitation_id" value={inv.id} />
                              <button
                                type="submit"
                                title="Resend invitation"
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          )}

                          {/* Cancel — only for pending */}
                          {inv.status === 'pending' && (
                            <form action={cancelInvitation}>
                              <input type="hidden" name="invitation_id" value={inv.id} />
                              <button
                                type="submit"
                                title="Cancel invitation"
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-600"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>

            {/* Row count */}
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-slate-400">
              Showing {filtered.length} of {totalSent} invitation{totalSent !== 1 ? 's' : ''}
              {(search || statusFilter) && ' (filtered)'}
            </div>
          </CardBody>
        </Card>
      )}
    </Workspace>
  );
}
