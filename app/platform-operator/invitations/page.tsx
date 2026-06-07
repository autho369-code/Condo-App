import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

function inviteStatusBadge(status: string | null | undefined) {
  if (!status) return <Badge className="bg-gray-50 text-gray-700 ring-gray-200">Unknown</Badge>;
  const s = status.toLowerCase();
  if (s === 'draft') return <Badge className="bg-gray-50 text-gray-600 ring-gray-200">Draft</Badge>;
  if (s === 'sent') return <Badge className="bg-blue-50 text-blue-700 ring-blue-200">Sent</Badge>;
  if (s === 'opened') return <Badge className="bg-purple-50 text-purple-700 ring-purple-200">Opened</Badge>;
  if (s === 'accepted') return <Badge className="bg-green-50 text-green-700 ring-green-200">Accepted</Badge>;
  if (s === 'expired') return <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Expired</Badge>;
  if (s === 'cancelled' || s === 'canceled') return <Badge className="bg-red-50 text-red-700 ring-red-200">Cancelled</Badge>;
  return <Badge className="bg-gray-50 text-gray-700 ring-gray-200">{status}</Badge>;
}

async function createInvitation(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const email = formData.get('email') as string;
  const fullName = (formData.get('full_name') as string) || null;
  const portfolioId = formData.get('portfolio_id') as string || null;
  const role = formData.get('hoa_role') as string || 'company_admin';
  const expiresAt = formData.get('expires_at') as string || null;

  const { error } = await (supabase as any).from('user_invitations').insert({
    email,
    full_name: fullName,
    portfolio_id: portfolioId || null,
    hoa_role: role,
    status: 'draft',
    expires_at: expiresAt || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/platform-operator/invitations');
  redirect('/platform-operator/invitations?created=1');
}

async function resendInvitation(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const invitationId = formData.get('invitation_id') as string;

  const { data: inv } = await (supabase as any)
    .from('user_invitations')
    .select('id, email, token, expires_at, portfolio_id')
    .eq('id', invitationId)
    .maybeSingle();

  if (!inv || !inv.email || !inv.token) return { error: 'Invitation not found or missing token.' };

  const { data: portfolio } = inv.portfolio_id
    ? await (supabase as any).from('portfolios').select('company_name').eq('id', inv.portfolio_id).maybeSingle()
    : { data: null };

  const companyName = portfolio?.company_name ?? 'your company';
  const inviteUrl = `https://portier369.com/invite?token=${encodeURIComponent(inv.token)}`;
  const expiryDate = inv.expires_at
    ? new Date(inv.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'soon';

  await (supabase as any).from('email_queue').insert({
    to_email: inv.email,
    subject: `Reminder: Set up your ${companyName} Portier369 account`,
    body: `<p>Hello,</p><p>This is a reminder for your Portier369 invitation.</p><p><a href="${inviteUrl}">Set up your account</a></p><p>Expires: ${expiryDate}</p>`.trim(),
    status: 'pending',
  });

  await (supabase as any).from('user_invitations').update({ status: 'sent' }).eq('id', invitationId);
  revalidatePath('/platform-operator/invitations');
  redirect('/platform-operator/invitations?resent=1');
}

async function cancelInvitation(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const invitationId = formData.get('invitation_id') as string;

  await (supabase as any).from('user_invitations').update({ status: 'cancelled' }).eq('id', invitationId);
  revalidatePath('/platform-operator/invitations');
  redirect('/platform-operator/invitations?cancelled=1');
}

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; resent?: string; cancelled?: string }>;
}) {
  const sp = await searchParams;
  const me = await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: invitations }, { data: portfolios }] = await Promise.all([
    db.from('user_invitations')
      .select('id, email, full_name, hoa_role, status, expires_at, created_at, invited_by, portfolio_id')
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('portfolios').select('id, company_name').order('company_name'),
  ]);

  const portfolioMap = new Map<string, string>();
  (portfolios ?? []).forEach((p: any) => portfolioMap.set(p.id, p.company_name));

  return (
    <div className="space-y-7">
      {sp.created === '1' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">Invitation created</h3>
          <p className="text-sm text-green-700 mt-1">The invitation has been saved as a draft.</p>
        </div>
      )}
      {sp.resent === '1' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">Invitation resent</h3>
          <p className="text-sm text-green-700 mt-1">The email has been queued for delivery.</p>
        </div>
      )}
      {sp.cancelled === '1' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">Invitation cancelled</h3>
          <p className="text-sm text-amber-700 mt-1">The invitation has been cancelled.</p>
        </div>
      )}

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
          <p className="text-xs text-gray-500">Create a draft invitation for a user in any portfolio.</p>
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
                <option value="assistant_manager">Assistant Manager</option>
                <option value="accounting_staff">Accounting Staff</option>
                <option value="board_member">Board Member</option>
                <option value="owner">Owner</option>
                <option value="vendor">Vendor</option>
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
              <TH>Invited By</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {(invitations ?? []).length === 0 ? (
              <TR>
                <TD colSpan={9} className="py-10 text-center text-gray-500">
                  No invitations found.
                </TD>
              </TR>
            ) : (
              (invitations ?? []).map((inv: any) => (
                <TR key={inv.id} className="hover:bg-gray-50">
                  <TD className="font-medium text-gray-950">{inv.full_name || '—'}</TD>
                  <TD className="text-gray-900">{inv.email}</TD>
                  <TD className="text-gray-700">{inv.portfolio_id ? portfolioMap.get(inv.portfolio_id) || '—' : '—'}</TD>
                  <TD className="text-xs text-gray-600">{inv.hoa_role?.replace(/_/g, ' ') || '—'}</TD>
                  <TD>{inviteStatusBadge(inv.status)}</TD>
                  <TD className="text-xs text-gray-500">{date(inv.expires_at)}</TD>
                  <TD className="text-xs text-gray-500">{date(inv.created_at)}</TD>
                  <TD className="text-xs text-gray-500">{inv.invited_by || '—'}</TD>
                  <TD>
                    <div className="flex items-center gap-1">
                      {inv.status !== 'accepted' && inv.status !== 'cancelled' && inv.status !== 'expired' && (
                        <form action={resendInvitation as any}>
                          <input type="hidden" name="invitation_id" value={inv.id} />
                          <Button type="submit" variant="ghost" size="sm">Resend</Button>
                        </form>
                      )}
                      {inv.status !== 'cancelled' && inv.status !== 'accepted' && (
                        <form action={cancelInvitation as any}>
                          <input type="hidden" name="invitation_id" value={inv.id} />
                          <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                        </form>
                      )}
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
