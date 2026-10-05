import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Alert } from '@/components/ui/shell';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { StatusChip } from '@/components/operations/status-chip';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, requirePlatformOperator } from '@/lib/auth/me';
import { date } from '@/lib/utils';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone, zonedWallTimeToUtc } from '@/lib/time/zoned';
import { cancelInvitation, regenerateInvitation, resendInvitation } from '../companies/actions';

export const dynamic = 'force-dynamic';

const RETURN_TO = '/platform-operator/invitations';
// The roles offered by the form below; anything else is refused. Operators
// seat a company's staff; board members, owners and tenants are invited by
// the company itself (a tenant invite never accepts without a unit_id).
const INVITABLE_ROLES = ['company_admin', 'manager'] as const;

// Status enum is {pending, accepted, revoked, expired}; "Resent" is derived from metadata.
function inviteStatusChip(inv: any) {
  const isExpired = inv.status === 'expired' || (inv.status === 'pending' && inv.expires_at && new Date(inv.expires_at) < new Date());
  if (inv.status === 'accepted') return <StatusChip tone="success">Accepted</StatusChip>;
  if (inv.status === 'revoked') return <StatusChip tone="neutral">Cancelled</StatusChip>;
  if (isExpired) return <StatusChip tone="warning">Expired</StatusChip>;
  if ((inv.metadata?.resent_count ?? 0) > 0) return <StatusChip tone="info">Resent</StatusChip>;
  return <StatusChip tone="info">Pending</StatusChip>;
}

async function createInvitation(formData: FormData) {
  'use server';
  // Minting invitations (including company-admin ones) needs the admin role.
  const me = await requirePlatformAdmin();
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const fullName = (formData.get('full_name') as string)?.trim() || null;
  const portfolioId = (formData.get('portfolio_id') as string) || null;
  const role = (formData.get('hoa_role') as string) || 'company_admin';
  const expiresOn = ((formData.get('expires_at') as string) || '').trim();

  if (!email) redirect(`${RETURN_TO}?error=${encodeURIComponent('Email is required.')}`);
  if (!portfolioId) redirect(`${RETURN_TO}?error=${encodeURIComponent('Select a company.')}`);
  if (!(INVITABLE_ROLES as readonly string[]).includes(role)) redirect(`${RETURN_TO}?error=${encodeURIComponent('Select a valid role.')}`);
  // Archived and suspended companies have logins disabled — an invitation
  // into one would send a link that can never be used.
  const { data: portfolio, error: portfolioError } = await (supabase as any)
    .from('portfolios')
    .select('id, archived_at, suspended_at')
    .eq('id', portfolioId)
    .maybeSingle();
  if (portfolioError) redirect(`${RETURN_TO}?error=${encodeURIComponent(portfolioError.message)}`);
  if (!portfolio) redirect(`${RETURN_TO}?error=${encodeURIComponent('That company was not found.')}`);
  if (portfolio.archived_at) redirect(`${RETURN_TO}?error=${encodeURIComponent('That company is archived — reactivate it before inviting users.')}`);
  if (portfolio.suspended_at) redirect(`${RETURN_TO}?error=${encodeURIComponent('That company is suspended — reactivate it before inviting users.')}`);
  // A date-only expiry means "through the end of that day" in the platform
  // zone; new Date('YYYY-MM-DD') would expire it at UTC midnight the day before
  // for US companies.
  const zone = displayTimeZone();
  let expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  if (expiresOn) {
    const endOfDay = zonedWallTimeToUtc(expiresOn, '23:59', zone);
    if (!endOfDay) redirect(`${RETURN_TO}?error=${encodeURIComponent('Enter a valid expiry date.')}`);
    if (expiresOn <= todayInZone(zone)) redirect(`${RETURN_TO}?error=${encodeURIComponent('The expiry date must be after today.')}`);
    expiresAt = (endOfDay as Date).toISOString();
  }

  const { error } = await (supabase as any).from('user_invitations').insert({
    email,
    full_name: fullName,
    portfolio_id: portfolioId,
    hoa_role: role,
    invited_by: me.auth_user_id,
    expires_at: expiresAt,
  });

  if (error) redirect(`${RETURN_TO}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(RETURN_TO);
  redirect(`${RETURN_TO}?created=1`);
}

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: invitations, error: invitationsError }, { data: portfolios, error: portfoliosError }] = await Promise.all([
    db.from('user_invitations')
      .select('id, email, full_name, hoa_role, status, expires_at, created_at, invited_by, portfolio_id, metadata')
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('portfolios').select('id, company_name, archived_at, suspended_at').order('company_name'),
  ]);

  const portfolioMap = new Map<string, string>();
  (portfolios ?? []).forEach((p: any) => portfolioMap.set(p.id, p.company_name));

  return (
    <div className="space-y-7">
      {sp.error && <Alert title="Action failed">{sp.error}</Alert>}
      {(invitationsError || portfoliosError) && (
        <Alert title="Invitations could not be loaded">{invitationsError?.message ?? portfoliosError?.message}</Alert>
      )}
      {sp.created === '1' && <Alert tone="success" title="Invitation created">The invitation email has been queued automatically — no need to resend it.</Alert>}
      {sp.resent === '1' && <Alert tone="success" title="Invitation resent">The email has been queued for delivery.</Alert>}
      {sp.cancelled === '1' && <Alert tone="warning" title="Invitation cancelled" />}
      {sp.regenerated === '1' && <Alert tone="success" title="New invitation link generated">The previous link was revoked and the new one emailed.</Alert>}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Invitations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all user invitations across every portfolio in the platform.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New invitation</CardTitle>
          <p className="text-xs text-gray-500">Create a pending invitation for a user in any portfolio.</p>
        </CardHeader>
        <CardBody>
          <form action={createInvitation as any} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" />
            </div>
            <div>
              <Label htmlFor="portfolio_id">Company</Label>
              <select id="portfolio_id" name="portfolio_id" required defaultValue="" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                {/* Every invitation belongs to a company (portfolio_id is NOT NULL). */}
                <option value="" disabled>Select a company</option>
                {(portfolios ?? []).filter((p: any) => !p.archived_at && !p.suspended_at).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="hoa_role">Role</Label>
              <select id="hoa_role" name="hoa_role" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="company_admin">Company Admin</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div>
              <Label htmlFor="expires_at">Expires at (optional)</Label>
              <Input id="expires_at" name="expires_at" type="date" />
            </div>
            <div className="col-span-full">
              <PendingSubmit pendingLabel="Creating…">Create Invitation</PendingSubmit>
            </div>
          </form>
        </CardBody>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-950">All invitations</h2>
          <p className="text-sm text-gray-500">{(invitations ?? []).length} invitations across all portfolios</p>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Company</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Expires</TH>
              <TH>Created</TH>
              <TH>Quick Actions</TH>
            </TR>
          </THead>
          <tbody>
            {(invitations ?? []).length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-10 text-center text-gray-500">
                  No invitations found.
                </TD>
              </TR>
            ) : (
              (invitations ?? []).map((inv: any) => {
                const actionable = inv.status === 'pending';
                // A fresh link only makes sense for an invitation still in
                // play; a cancelled (revoked) one must stay cancelled.
                const canRegenerate = inv.status === 'pending' || inv.status === 'expired';
                return (
                  <TR key={inv.id} className="hover:bg-gray-50">
                    <TD className="font-medium text-gray-950">{inv.full_name || '—'}</TD>
                    <TD className="text-gray-900">{inv.email}</TD>
                    <TD className="text-gray-700">{inv.portfolio_id ? portfolioMap.get(inv.portfolio_id) || '—' : '—'}</TD>
                    <TD className="text-xs text-gray-600">{inv.hoa_role?.replace(/_/g, ' ') || '—'}</TD>
                    <TD>{inviteStatusChip(inv)}</TD>
                    <TD className="text-xs text-gray-500">{date(inv.expires_at)}</TD>
                    <TD className="text-xs text-gray-500">{date(inv.created_at)}</TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        {actionable && (
                          <form action={resendInvitation as any}>
                            <input type="hidden" name="invitation_id" value={inv.id} />
                            <input type="hidden" name="return_to" value={RETURN_TO} />
                            <Button type="submit" variant="ghost" size="sm">Resend</Button>
                          </form>
                        )}
                        {actionable && (
                          <form action={cancelInvitation as any}>
                            <input type="hidden" name="invitation_id" value={inv.id} />
                            <input type="hidden" name="return_to" value={RETURN_TO} />
                            <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                          </form>
                        )}
                        {canRegenerate && (
                          <form action={regenerateInvitation as any}>
                            <input type="hidden" name="invitation_id" value={inv.id} />
                            <input type="hidden" name="return_to" value={RETURN_TO} />
                            <Button type="submit" variant="ghost" size="sm">New Link</Button>
                          </form>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
