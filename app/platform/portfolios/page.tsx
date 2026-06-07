import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import {
  formatSeatUsage,
  platformStatus,
  statusClass,
  toCount,
  summarizePortfolioHealth,
  type PortfolioHealthRow,
} from '@/lib/platform/metrics';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function provisionPortfolio(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const companyName = formData.get('name') as string;
  const adminEmail = formData.get('email') as string;
  const adminName = (formData.get('admin_name') as string) || undefined;
  const trialDays = parseInt(formData.get('trial_days') as string) || 14;

  const { data, error } = await (supabase as any).rpc('provision_portfolio', {
    p_company_name: companyName,
    p_first_admin_email: adminEmail,
    p_first_admin_name: adminName,
    p_tier: (formData.get('tier') as any) || 'core',
    p_seats: parseInt(formData.get('seats') as string) || 5,
    p_trial_days: trialDays,
  });
  if (error) return { error: error.message };
  revalidatePath('/platform/portfolios');

  const token = data?.invitation_token;
  const inviteUrl = token ? `https://portier369.com/invite?token=${encodeURIComponent(token)}` : null;

  // Queue the invitation email
  if (inviteUrl) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + trialDays);
    const expiryDate = expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    await (supabase as any).from('email_queue').insert({
      to_email: adminEmail,
      to_name: adminName ?? companyName,
      subject: `Welcome to Portier369 — Set up your ${companyName} account`,
      body: `\
<p>Hello${adminName ? ' ' + adminName : ''},</p>
<p>You've been invited to join <strong>Portier369</strong> as the administrator for <strong>${companyName}</strong>.</p>
<p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background-color:#10B981;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Set up your account</a></p>
<p>Or copy this link into your browser:</p>
<p><code>${inviteUrl}</code></p>
<p>This invitation expires on <strong>${expiryDate}</strong>.</p>
<p>— The Portier369 Team</p>`.trim(),
      status: 'pending',
    });
  }

  if (token) {
    const redirectUrl = `/platform/portfolios?invited=1&token=${encodeURIComponent(token)}`;
    redirect(redirectUrl);
  }
  redirect('/platform/portfolios');
}

async function resendPortfolioInvites(formData: FormData) {
  'use server';
  const portfolioId = formData.get('portfolio_id') as string;
  const supabase = await createClient();

  const { data: invitations } = await (supabase as any)
    .from('user_invitations')
    .select('id, email, token, expires_at')
    .eq('portfolio_id', portfolioId)
    .eq('status', 'pending')
    .is('used_at', null);

  if (!invitations || invitations.length === 0) {
    return { error: 'No pending invitations.' };
  }

  const { data: portfolio } = await (supabase as any)
    .from('portfolios')
    .select('company_name')
    .eq('id', portfolioId)
    .single();

  const companyName = portfolio?.company_name ?? 'Your company';

  for (const inv of invitations) {
    if (!inv.email || !inv.token) continue;
    const inviteUrl = `https://portier369.com/invite?token=${encodeURIComponent(inv.token)}`;
    const expiryDate = inv.expires_at
      ? new Date(inv.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'soon';

    await (supabase as any).from('email_queue').insert({
      to_email: inv.email,
      subject: `Reminder: Set up your ${companyName} Portier369 account`,
      body: `\
<p>Hello,</p>
<p>This is a reminder that you have a pending invitation to join <strong>${companyName}</strong> on <strong>Portier369</strong>.</p>
<p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background-color:#10B981;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Set up your account</a></p>
<p>Or copy this link into your browser:</p>
<p><code>${inviteUrl}</code></p>
<p>This invitation expires on <strong>${expiryDate}</strong>.</p>
<p>— The Portier369 Team</p>`.trim(),
      status: 'pending',
    });
  }

  revalidatePath('/platform/portfolios');
  redirect('/platform/portfolios?resent=1');
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

export default async function PortfoliosPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string; token?: string; resent?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await (supabase as any).from('v_portfolio_health').select('*').order('company_name');
  const rows = (data ?? []) as PortfolioHealthRow[];
  const summary = summarizePortfolioHealth(rows);

  const inviteUrl = sp.token ? `https://portier369.com/invite?token=${sp.token}` : null;

  return (
    <div className="space-y-7">
      {sp.invited === '1' && inviteUrl && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-green-900">Company provisioned</h3>
              <p className="text-sm text-green-700 mt-1">
                Share this link with the company admin to set their password:
              </p>
              <div className="mt-2">
                <code className="rounded bg-white px-3 py-1.5 text-sm font-mono text-gray-900 border border-gray-200 break-all select-all">{inviteUrl}</code>
              </div>
            </div>
          </div>
        </div>
      )}
      {sp.resent === '1' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">Invites resent</h3>
          <p className="text-sm text-green-700 mt-1">
            Invitation emails have been queued for all pending invites.
          </p>
        </div>
      )}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Clients</h1>
          <p className="mt-1 text-sm text-gray-500">
            Platform control across every management company, property, seat, and billing state.
          </p>
        </div>
        <Link href="/platform/system-health" className="text-sm font-medium text-blue-700 hover:underline">
          Review platform health
        </Link>
      </header>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Clients" value={summary.totalClients} sub={`${summary.paidAccounts} paid, ${summary.trialAccounts} trial`} />
        <Stat label="Properties" value={summary.totalProperties} sub="Association records" />
        <Stat label="Units" value={summary.totalUnits} sub="Across all clients" />
        <Stat label="Seats" value={`${summary.activeSeats} / ${summary.includedSeats || '-'}`} sub="Used seats" />
        <Stat label="Invites" value={summary.pendingInvitations} sub="Pending activation" />
        <Stat label="Alerts" value={summary.alertCount} sub={`${summary.failedLogins24h} failed logins`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provision client</CardTitle>
          <p className="text-xs text-gray-500">Create the client shell, first manager admin, tier, seats, and trial window.</p>
        </CardHeader>
        <CardBody>
          <form action={provisionPortfolio as any} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="name">Company name</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="email">First admin email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="admin_name">Admin name (optional)</Label>
              <Input id="admin_name" name="admin_name" />
            </div>
            <div>
              <Label htmlFor="tier">Tier</Label>
              <select id="tier" name="tier" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="core">Core</option>
                <option value="plus">Plus</option>
                <option value="max">Max</option>
              </select>
            </div>
            <div>
              <Label htmlFor="seats">Seats</Label>
              <Input id="seats" name="seats" type="number" defaultValue={5} min={1} />
            </div>
            <div>
              <Label htmlFor="trial_days">Trial days</Label>
              <Input id="trial_days" name="trial_days" type="number" defaultValue={14} min={0} />
            </div>
            <div className="col-span-full">
              <Button type="submit">Provision</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-950">Client directory</h2>
          <p className="text-sm text-gray-500">Drill into a client to review properties, owners, users, and billing.</p>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH>Tier</TH>
              <TH>Status</TH>
              <TH className="text-right">Properties</TH>
              <TH className="text-right">Units</TH>
              <TH className="text-right">Seats</TH>
              <TH className="text-right">Pending invites</TH>
              <TH className="text-right">Failed logins</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={9} className="py-10 text-center text-gray-500">
                  No clients are visible to this platform operator.
                </TD>
              </TR>
            ) : (
              rows.map((p) => {
                const status = platformStatus(p);
                return (
                  <TR key={p.portfolio_id} className="hover:bg-gray-50">
                    <TD>
                      <Link href={`/platform/portfolios/${p.portfolio_id}`} className="font-medium text-blue-700 hover:underline">
                        {p.company_name ?? 'Unnamed client'}
                      </Link>
                    </TD>
                    <TD className="uppercase">{p.tier ?? '-'}</TD>
                    <TD>
                      <Badge className={statusClass(status)}>{status.replace(/_/g, ' ')}</Badge>
                    </TD>
                    <TD className="text-right">{p.association_count ?? 0}</TD>
                    <TD className="text-right">{p.unit_count ?? 0}</TD>
                    <TD className="text-right">{formatSeatUsage(p)}</TD>
                    <TD className="text-right">{p.pending_invitations ?? 0}</TD>
                    <TD className={`text-right ${toCount(p.failed_logins_24h) > 0 ? 'font-medium text-red-600' : ''}`}>
                      {p.failed_logins_24h ?? 0}
                    </TD>
                    <TD className="text-right">
                      <form action={resendPortfolioInvites as any}>
                        <input type="hidden" name="portfolio_id" value={p.portfolio_id ?? ''} />
                        <Button type="submit" variant="ghost" size="sm">Resend</Button>
                      </form>
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
