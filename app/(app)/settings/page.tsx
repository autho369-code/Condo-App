import { createClient } from '@/lib/supabase/server';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { updatePortfolioPolicy } from '@/lib/rpcs/portfolio';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomBytes } from 'crypto';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function inviteStaff(formData: FormData) {
  'use server';
  const supabase = await (await import('@/lib/supabase/server')).createClient();
  const { error } = await (supabase as any).rpc('invite_staff', {
    p_portfolio_id: formData.get('portfolio_id') as string,
    p_email: formData.get('email') as string,
    p_role_name: (formData.get('role_name') as string) || 'Property Manager',
    p_message: (formData.get('message') as string) || undefined,
  });
  if (error) return { error: error.message };
  revalidatePath('/settings');
}

async function resetStaffPassword(formData: FormData) {
  'use server';
  const authUserId = formData.get('auth_user_id') as string;
  const email = formData.get('email') as string;

  if (!authUserId) {
    redirect('/settings?reset_error=' + encodeURIComponent(email) + '&reason=no_auth_user');
  }

  // Generate a secure random temporary password: 12 chars, alphanumeric
  const tempPassword = randomBytes(9).toString('base64url').slice(0, 12);

  const adminClient = (await import('@/lib/supabase/server')).createServiceClient();
  const { error } = await (adminClient.auth as any).admin.updateUserById(authUserId, {
    password: tempPassword,
    email_confirm: true,
  });

  if (error) {
    redirect('/settings?reset_error=' + encodeURIComponent(email) + '&reason=' + encodeURIComponent(error.message));
  }

  redirect('/settings?reset_success=' + encodeURIComponent(email) + '&temp_password=' + encodeURIComponent(tempPassword));
}

async function removeStaffMember(formData: FormData) {
  'use server';
  const supabase = await (await import('@/lib/supabase/server')).createClient();
  await (supabase as any).rpc('remove_staff_member', {
    p_profile_id: formData.get('profile_id') as string,
    p_reason: 'Removed by admin',
  });
  revalidatePath('/settings');
}

async function changeStaffRole(formData: FormData) {
  'use server';
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
  searchParams: Promise<{ reset_success?: string; temp_password?: string; reset_error?: string; reason?: string }>;
}) {
  const sp = await searchParams;
  const me = await requirePortfolioAdmin();
  const supabase = await createClient();
  const portfolioId = me.portfolio?.id as string;

  const [{ data: portfolio }, { data: team }, { data: invites }] = await Promise.all([
    (supabase as any).from('portfolios').select('*').eq('id', portfolioId).single(),
    (supabase as any).from('profiles').select('id, email, full_name, role_id, hoa_role, last_login_at, auth_user_id').eq('portfolio_id', portfolioId).order('full_name'),
    (supabase as any).from('v_pending_invitations').select('*'),
  ]);

  const updatePolicy = updatePortfolioPolicy.bind(null, portfolioId);

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="space-y-8">
      <header><h1 className="text-2xl font-semibold">Settings</h1></header>

      {/* ======== PASSWORD RESET FEEDBACK ======== */}
      {sp.reset_success && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Password reset for {sp.reset_success}</p>
          <p className="mt-1 text-sm text-green-700">
            Temporary password: <code className="rounded bg-green-100 px-2 py-0.5 font-mono font-bold">{sp.temp_password}</code>
          </p>
          <p className="mt-1 text-xs text-green-600">Share this password with the team member. They will be prompted to change it on next login.</p>
        </div>
      )}
      {sp.reset_error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Failed to reset password for {sp.reset_error}</p>
          {sp.reason && <p className="mt-1 text-xs text-red-600">{sp.reason}</p>}
        </div>
      )}

      {/* ======== PORTFOLIO POLICY ======== */}
      <Card>
        <CardHeader><CardTitle>Portfolio policy</CardTitle></CardHeader>
        <CardBody>
          <form action={updatePolicy as any} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
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

            <div className="md:col-span-2 border-t border-gray-100 pt-4">
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
                defaultValue={(portfolio?.default_payment_reminder_days ?? [14,7,1,-7,-30]).join(', ')} />
              <p className="mt-1 text-xs text-gray-500">Comma-separated. Positive = before due, negative = after due.</p>
            </div>

            <div className="md:col-span-2 border-t border-gray-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Fiscal year &amp; statements</h3>
            </div>
            <div>
              <Label htmlFor="fiscal_year_start_month">Fiscal year starts in month</Label>
              <select id="fiscal_year_start_month" name="fiscal_year_start_month"
                defaultValue={portfolio?.fiscal_year_start_month ?? 1}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                  <option key={i+1} value={i+1}>{i+1} — {m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="statement_generation_day">Statement generation day of month</Label>
              <Input id="statement_generation_day" name="statement_generation_day" type="number" min="1" max="28"
                defaultValue={portfolio?.statement_generation_day ?? 1} />
            </div>

            <div className="md:col-span-2 border-t border-gray-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Security</h3>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="require_mfa_for_admins" defaultChecked={portfolio?.require_mfa_for_admins} />
              Require MFA for portfolio admins
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="require_mfa_for_staff" defaultChecked={portfolio?.require_mfa_for_staff} />
              Require MFA for all staff
            </label>

            <div className="md:col-span-2 border-t border-gray-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Online payment fees</h3>
            </div>
            <div>
              <Label htmlFor="convenience_fee_mode">Convenience fee mode</Label>
              <select id="convenience_fee_mode" name="convenience_fee_mode"
                defaultValue={portfolio?.convenience_fee_mode ?? 'pass_through'}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="absorb">Absorb (management co pays)</option>
                <option value="pass_through">Pass through to owner</option>
                <option value="split">Split 50/50</option>
                <option value="flat_addon">Flat add-on</option>
              </select>
            </div>
            <div>
              <Label htmlFor="convenience_fee_card_pct">Card fee % passed through</Label>
              <Input id="convenience_fee_card_pct" name="convenience_fee_card_pct" type="number" step="0.01" min="0" max="10"
                defaultValue={portfolio?.convenience_fee_card_pct ?? 2.9} />
            </div>

            <div className="md:col-span-2 flex justify-end"><Button type="submit">Save policy</Button></div>
          </form>
        </CardBody>
      </Card>

      {/* ======== INVITE STAFF ======== */}
      <Card>
        <CardHeader><CardTitle>Invite a staff member</CardTitle></CardHeader>
        <CardBody>
          <form action={inviteStaff as any} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input type="hidden" name="portfolio_id" value={portfolioId} />
            <div className="md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="role_name">Role</Label>
              <select id="role_name" name="role_name" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm" defaultValue="President">
                <option>President</option><option>Property Manager</option><option>Accountant</option>
                <option>On-Site Manager</option>
              </select>
            </div>
            <div className="flex items-end"><Button type="submit" className="w-full">Send invite</Button></div>
            <div className="md:col-span-4">
              <Label htmlFor="message">Message (optional)</Label>
              <Input id="message" name="message" />
            </div>
          </form>
        </CardBody>
      </Card>

      {/* ======== TEAM ======== */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Team</h2>
        <Table>
          <THead><TR><TH>Email</TH><TH>Name</TH><TH>HOA role</TH><TH>Last login</TH><TH className="w-32">Actions</TH></TR></THead>
          <tbody>
            {(team ?? []).map((m: any) => (
              <TR key={m.id}>
                <TD className="font-medium">{m.email}</TD>
                <TD>{m.full_name ?? '—'}</TD>
                <TD className="uppercase">{m.hoa_role}</TD>
                <TD>{date(m.last_login_at) ?? '—'}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    <form action={changeStaffRole}>
                      <input type="hidden" name="profile_id" value={m.id} />
                      <select name="role" className="h-8 rounded border border-gray-200 text-xs px-1" defaultValue=""
                        onChange={(e) => { if (e.target.value) (e.target.form as HTMLFormElement).requestSubmit(); }}>
                        <option value="">Change role</option>
                        <option>President</option><option>Property Manager</option><option>Accountant</option>
                        <option>On-Site Manager</option>
                      </select>
                      <noscript><button type="submit" className="ml-1 h-8 rounded border px-1 text-xs">Go</button></noscript>
                    </form>
                    <form action={resetStaffPassword}>
                      <input type="hidden" name="auth_user_id" value={m.auth_user_id ?? ''} />
                      <input type="hidden" name="email" value={m.email} />
                      <button type="submit" className="h-8 rounded border border-blue-200 px-2 text-xs text-blue-600 hover:bg-blue-50">Reset PW</button>
                    </form>
                    <form action={removeStaffMember}>
                      <input type="hidden" name="profile_id" value={m.id} />
                      <button type="submit" className="h-8 rounded border border-red-200 px-2 text-xs text-red-600 hover:bg-red-50">Remove</button>
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
        <h2 className="mb-3 text-lg font-semibold">Pending invitations</h2>
        <Table>
          <THead><TR><TH>Email</TH><TH>Role</TH><TH>Expires</TH><TH>Invited</TH></TR></THead>
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
    </div>
  );
}
