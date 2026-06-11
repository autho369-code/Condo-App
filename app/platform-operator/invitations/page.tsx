import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Alert } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { date } from '@/lib/utils';
import { cancelInvitation, regenerateInvitation, resendInvitation } from '../companies/actions';

export const dynamic = 'force-dynamic';

const RETURN_TO = '/platform-operator/invitations';

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
  const me = await requirePlatformOperator();
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const fullName = (formData.get('full_name') as string)?.trim() || null;
  const portfolioId = (formData.get('portfolio_id') as string) || null;
  const role = (formData.get('hoa_role') as string) || 'company_admin';
  const expiresAt = (formData.get('expires_at') as string) || null;

  const { error } = await (supabase as any).from('user_invitations').insert({
    email,
    full_name: fullName,
    portfolio_id: portfolioId || null,
    hoa_role: role,
    invited_by: me.auth_user_id,
    expires_at: expiresAt || new Date(Date.now() + 30 * 86400000).toISOString(),
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

  const [{ data: invitations }, { data: portfolios }] = await Promise.all([
    db.from('user_invitations')
      .select('id, email, full_name, hoa_role, status, expires_at, created_at, invited_by, portfolio_id, metadata')
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('portfolios').select('id, company_name').order('company_name'),
  ]);

  const portfolioMap = new Map<string, string>();
  (portfolios ?? []).forEach((p: any) => portfolioMap.set(p.id, p.company_name));

  return (
    <div className="space-y-7">
      {sp.error && <Alert title="Action failed">{sp.error}</Alert>}
      {sp.created === '1' && <Alert tone="success" title="Invitation created">The invitation is pending — use Resend to queue the email.</Alert>}
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
              <select id="portfolio_id" name="portfolio_id" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">No company</option>
                {(portfolios ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="hoa_role">Role</Label>
              <select id="hoa_role" name="hoa_role" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="company_admin">Company Admin</option>
                <option value="manager">Manager</option>
                <option value="board">Board Member</option>
                <option value="owner">Owner</option>
                <option value="tenant">Tenant</option>
              </select>
            </div>
            <div>
              <Label htmlFor="expires_at">Expires at (optional)</Label>
              <Input id="expires_at" name="expires_at" type="date" />
            </div>
            <div className="col-span-full">
              <Button type="submit">Create Invitation</Button>
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
                        {inv.status !== 'accepted' && (
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
