import { createClient } from '@/lib/supabase/server';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { Input, Label, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, PageHeader, PageShell, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { updatePortfolioPolicy } from '@/lib/rpcs/portfolio';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { date } from '@/lib/utils';
import { queueEmails } from '@/lib/email/queue';
import { siteUrl } from '@/lib/url/site-url';

export const dynamic = 'force-dynamic';

// Server Actions are callable endpoints in their own right — every mutation
// below re-checks authorization INSIDE the action (defense-in-depth on top of
// the page-level requirePortfolioAdmin) and scopes targets to the caller's
// own portfolio before touching anything.

async function inviteStaff(formData: FormData) {
  'use server';
  const { requirePortfolioAdmin: guard } = await import('@/lib/auth/me');
  const me = await guard();
  const supabase = await (await import('@/lib/supabase/server')).createClient();
  const { error } = await (supabase as any).rpc('invite_staff', {
    // Never trust a portfolio id from the form — invitations always target
    // the caller's own portfolio.
    p_portfolio_id: me.portfolio?.id,
    p_email: formData.get('email') as string,
    p_role_name: (formData.get('role_name') as string) || 'Property Manager',
    p_message: (formData.get('message') as string) || undefined,
  });
  if (error) {
    redirect('/settings?invite_error=' + encodeURIComponent(error.message));
  }
  revalidatePath('/settings');
}

async function resetStaffPassword(formData: FormData) {
  'use server';
  const { requirePortfolioAdmin: guard } = await import('@/lib/auth/me');
  const me = await guard();
  const authUserId = formData.get('auth_user_id') as string;
  const email = formData.get('email') as string;

  if (!authUserId) {
    redirect('/settings?reset_error=' + encodeURIComponent(email) + '&reason=no_auth_user');
  }

  const { createServiceClient } = await import('@/lib/supabase/server');
  const adminClient = createServiceClient();

  // The target must be a member of the caller's own portfolio — a portfolio
  // admin must never be able to reset an account outside their company.
  const { data: target } = await (adminClient as any)
    .from('profiles')
    .select('id, portfolio_id, email, full_name')
    .eq('id', authUserId)
    .maybeSingle();
  if (!target || !me.portfolio?.id || target.portfolio_id !== me.portfolio.id) {
    redirect('/settings?reset_error=' + encodeURIComponent(email) + '&reason=' + encodeURIComponent('That account is not in your portfolio.'));
  }

  // Do not trust the hidden email field and never let an administrator know
  // or choose another user's password. The profile email must match the
  // confirmed auth email before a provider-generated recovery link is queued.
  const profileEmail = String(target.email ?? '').trim().toLowerCase();
  const { data: authData, error: authLookupError } = await (adminClient.auth as any).admin.getUserById(authUserId);
  const authUser = authData?.user;
  const authEmail = String(authUser?.email ?? '').trim().toLowerCase();
  if (
    authLookupError
    || !profileEmail
    || !authUser
    || authUser.id !== authUserId
    || authEmail !== profileEmail
    || !authUser.email_confirmed_at
  ) {
    redirect('/settings?reset_error=' + encodeURIComponent(profileEmail || email) + '&reason=' + encodeURIComponent('The staff profile must have a matching verified sign-in email before a reset link can be sent.'));
  }

  const { data: linkData, error: linkError } = await (adminClient.auth as any).admin.generateLink({
    type: 'recovery',
    email: profileEmail,
    options: { redirectTo: `${siteUrl()}/api/auth/callback?next=/reset-password` },
  });
  if (
    linkError
    || !linkData?.properties?.action_link
    || linkData.user?.id !== authUserId
    || String(linkData.user?.email ?? '').trim().toLowerCase() !== profileEmail
  ) {
    redirect('/settings?reset_error=' + encodeURIComponent(profileEmail) + '&reason=' + encodeURIComponent(linkError?.message ?? 'Could not create a recovery link for that verified account.'));
  }

  const queued = await queueEmails(adminClient as any, [{
    to: profileEmail,
    toName: target.full_name ?? null,
    subject: 'Reset your Portier369 password',
    text: [
      'A portfolio administrator requested a password reset for your Portier369 staff account.',
      '',
      `Choose a new password: ${linkData.properties.action_link}`,
      '',
      'This recovery link expires after a short time. If you did not expect it, contact your portfolio administrator.',
    ].join('\n'),
    portfolioId: target.portfolio_id,
    sentBy: me.auth_user_id,
  }]);
  if (queued.error || queued.count !== 1) {
    redirect('/settings?reset_error=' + encodeURIComponent(profileEmail) + '&reason=' + encodeURIComponent(queued.error ?? 'The recovery email could not be queued.'));
  }

  const { error: auditError } = await (adminClient as any).from('audit_logs').insert({
    entity_type: 'profile',
    entity_id: authUserId,
    action: 'password_reset_sent',
    actor_id: me.auth_user_id,
    actor_email: me.profile?.email ?? me.email ?? null,
    changes: { target_email: profileEmail, method: 'verified_email_recovery_link', delivery: 'email_queue' },
  });
  if (auditError) {
    redirect('/settings?reset_error=' + encodeURIComponent(profileEmail) + '&reason=' + encodeURIComponent('The recovery email was queued, but the required audit event could not be recorded.'));
  }

  redirect('/settings?reset_success=' + encodeURIComponent(profileEmail));
}

async function removeStaffMember(formData: FormData) {
  'use server';
  const { requirePortfolioAdmin: guard } = await import('@/lib/auth/me');
  await guard();
  // RLS scopes the caller's client; the SECURITY DEFINER RPC re-validates the
  // caller's authority over the target profile in Postgres.
  const supabase = await (await import('@/lib/supabase/server')).createClient();
  await (supabase as any).rpc('remove_staff_member', {
    p_profile_id: formData.get('profile_id') as string,
    p_reason: 'Removed by admin',
  });
  revalidatePath('/settings');
}

async function changeStaffRole(formData: FormData) {
  'use server';
  const { requirePortfolioAdmin: guard } = await import('@/lib/auth/me');
  await guard();
  const supabase = await (await import('@/lib/supabase/server')).createClient();
  const role = formData.get('role') as string;
  if (role) {
    await (supabase as any).rpc('assign_role', {
      p_profile_id: formData.get('profile_id') as string,
      p_role_name: role,
    });
  }
  revalidatePath('/settings');
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ reset_success?: string; reset_error?: string; reason?: string; invite_error?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const me = await requirePortfolioAdmin();
  const supabase = await createClient();
  const portfolioId = me.portfolio?.id as string;

  const [{ data: portfolio }, { data: team }, { data: invites }] = await Promise.all([
    (supabase as any).from('portfolios').select('*').eq('id', portfolioId).single(),
    // profiles.id is the auth user id; there is no separate auth_user_id
    // column on this table.
    (supabase as any).from('profiles').select('id, email, full_name, role_id, hoa_role, last_login_at').eq('portfolio_id', portfolioId).order('full_name'),
    (supabase as any).from('v_pending_invitations').select('*'),
  ]);

  const updatePolicy = updatePortfolioPolicy.bind(null, portfolioId);

  return (
    <PageShell>
      <PageHeader title="Settings" description="Portfolio policy, team management, and invitations." />

      <div className="space-y-6">
        {/* ======== FEEDBACK ======== */}
        {sp.reset_success && (
          <Alert tone="success" title={`Password recovery queued for ${sp.reset_success}.`}>
            A time-limited recovery link was queued only to the staff member&apos;s verified sign-in email. Administrators never see or set the new password.
          </Alert>
        )}
        {sp.reset_error && (
          <Alert tone="danger" title={`Failed to reset password for ${sp.reset_error}.`}>
            {sp.reason}
          </Alert>
        )}
        {sp.invite_error && (
          <Alert tone="danger" title="Could not send invitation:">{sp.invite_error}</Alert>
        )}
        {sp.error && (
          <Alert tone="danger" title="Could not save settings:">{sp.error}</Alert>
        )}

        {/* ======== PORTFOLIO POLICY ======== */}
        <Surface>
          <SectionTitle title="Portfolio policy" />
          <form action={updatePolicy as any} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="company_name">Company name</Label>
              <Input id="company_name" name="company_name" defaultValue={portfolio?.company_name ?? ''} />
            </div>
            <div>
              <Label htmlFor="phone_number">Main phone</Label>
              <Input id="phone_number" name="phone_number" defaultValue={portfolio?.phone_number ?? ''} />
            </div>
            <div>
              <Label htmlFor="texting_phone_number">Texting (SMS) number</Label>
              <Input id="texting_phone_number" name="texting_phone_number" defaultValue={portfolio?.texting_phone_number ?? ''} />
            </div>

            <div className="border-t border-gray-100 pt-4 sm:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">NSF fee</h3>
            </div>
            <div>
              <Label htmlFor="nsf_fee_amount">NSF fee ($) — auto-applied to owner account</Label>
              <Input id="nsf_fee_amount" name="nsf_fee_amount" type="number" step="0.01" min="0"
                defaultValue={portfolio?.default_nsf_fee_amount ?? 35} />
              <p className="mt-1 text-xs text-gray-500">Charged automatically when a payment is returned. Applied per-occurrence to the owner ledger.</p>
            </div>
            <div>
              <Label htmlFor="reminder_days">Payment reminder schedule (days before/after due)</Label>
              <Input id="reminder_days" name="reminder_days"
                defaultValue={(portfolio?.default_payment_reminder_days ?? [14, 7, 1, -7, -30]).join(', ')} />
              <p className="mt-1 text-xs text-gray-500">Comma-separated. Positive = before due, negative = after due.</p>
            </div>

            <div className="border-t border-gray-100 pt-4 sm:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Fiscal year &amp; statements</h3>
            </div>
            <div>
              <Label htmlFor="fiscal_year_start_month">Fiscal year starts in month</Label>
              <Select id="fiscal_year_start_month" name="fiscal_year_start_month"
                defaultValue={portfolio?.fiscal_year_start_month ?? 1}>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1} — {m}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="statement_generation_day">Statement generation day of month</Label>
              <Input id="statement_generation_day" name="statement_generation_day" type="number" min="1" max="28"
                defaultValue={portfolio?.statement_generation_day ?? 1} />
            </div>

            <div className="border-t border-gray-100 pt-4 sm:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Security</h3>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="require_mfa_for_admins" defaultChecked={portfolio?.require_mfa_for_admins} className="h-4 w-4 rounded border-gray-300" />
              Require MFA for portfolio admins
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="require_mfa_for_staff" defaultChecked={portfolio?.require_mfa_for_staff} className="h-4 w-4 rounded border-gray-300" />
              Require MFA for all staff
            </label>

            <div className="border-t border-gray-100 pt-4 sm:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Online payment fees</h3>
            </div>
            <div>
              <Label htmlFor="convenience_fee_mode">Convenience fee mode</Label>
              <Select id="convenience_fee_mode" name="convenience_fee_mode"
                defaultValue={portfolio?.convenience_fee_mode ?? 'pass_through'}>
                <option value="absorb">Absorb (management co pays)</option>
                <option value="pass_through">Pass through to owner</option>
                <option value="split">Split 50/50</option>
                <option value="flat_addon">Flat add-on</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="convenience_fee_card_pct">Card fee % passed through</Label>
              <Input id="convenience_fee_card_pct" name="convenience_fee_card_pct" type="number" step="0.01" min="0" max="10"
                defaultValue={portfolio?.convenience_fee_card_pct ?? 2.9} />
            </div>

            <div className="sm:col-span-2"><Button type="submit">Save policy</Button></div>
          </form>
        </Surface>

        {/* ======== INVITE STAFF ======== */}
        <Surface>
          <SectionTitle title="Invite a staff member" />
          <form action={inviteStaff as any} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input type="hidden" name="portfolio_id" value={portfolioId} />
            <div className="sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="role_name">Role</Label>
              <Select id="role_name" name="role_name" defaultValue="President">
                <option>President</option><option>Property Manager</option><option>Accountant</option>
                <option>On-Site Manager</option>
              </Select>
            </div>
            <div className="flex items-end"><Button type="submit" className="w-full">Send invite</Button></div>
            <div className="sm:col-span-4">
              <Label htmlFor="message">Message (optional)</Label>
              <Input id="message" name="message" />
            </div>
          </form>
        </Surface>

        {/* ======== TEAM ======== */}
        <section>
          <SectionTitle title="Team" />
          <Table>
            <THead><tr><TH>Email</TH><TH>Name</TH><TH>HOA role</TH><TH>Last login</TH><TH className="w-64">Actions</TH></tr></THead>
            <tbody>
              {(team ?? []).map((m: any) => (
                <TR key={m.id}>
                  <TD className="font-medium">{m.email}</TD>
                  <TD>{m.full_name ?? '—'}</TD>
                  <TD className="uppercase">{m.hoa_role}</TD>
                  <TD>{date(m.last_login_at) ?? '—'}</TD>
                  <TD>
                    <div className="flex flex-wrap items-center gap-1">
                      <form action={changeStaffRole} className="flex items-center gap-1">
                        <input type="hidden" name="profile_id" value={m.id} />
                        <select
                          name="role"
                          defaultValue=""
                          aria-label="Change role"
                          className="h-8 rounded-lg border border-gray-300 bg-white px-1 text-xs text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">Change role</option>
                          <option>President</option><option>Property Manager</option><option>Accountant</option>
                          <option>On-Site Manager</option>
                        </select>
                        <button type="submit" className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">Apply</button>
                      </form>
                      <form action={resetStaffPassword}>
                        <input type="hidden" name="auth_user_id" value={m.id} />
                        <input type="hidden" name="email" value={m.email} />
                        <button type="submit" className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">Send reset link</button>
                      </form>
                      <form action={removeStaffMember}>
                        <input type="hidden" name="profile_id" value={m.id} />
                        <button type="submit" className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">Remove</button>
                      </form>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>

        {/* ======== PENDING INVITATIONS ======== */}
        <section>
          <SectionTitle title="Pending invitations" />
          <Table>
            <THead><tr><TH>Email</TH><TH>Role</TH><TH>Expires</TH><TH>Invited</TH></tr></THead>
            <tbody>
              {(invites ?? []).map((i: any) => (
                <TR key={i.id}>
                  <TD className="font-medium">{i.email}</TD>
                  <TD>{i.role_name ?? i.hoa_role}</TD>
                  <TD>{date(i.expires_at)}</TD>
                  <TD>{date(i.created_at)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>
      </div>
    </PageShell>
  );
}
