import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { requireAuth } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';

export const dynamic = 'force-dynamic';

// Where "Back" should land for each role.
function homeHref(me: Awaited<ReturnType<typeof requireAuth>>): string {
  if (me.is_platform_operator) return '/platform-operator';
  if (me.is_staff) return '/dashboard';
  if (me.is_board) return '/board';
  if (me.vendor_id) return '/vendor';
  if (me.owner_id) return '/portal';
  return '/dashboard';
}

async function changePassword(formData: FormData) {
  'use server';
  const me = await requireAuth();
  const supabase = await createClient();

  const failTo = (msg: string) => redirect('/account?error=' + encodeURIComponent(msg));

  const current = (formData.get('current_password') as string) ?? '';
  const next = (formData.get('new_password') as string) ?? '';
  const confirm = (formData.get('confirm_password') as string) ?? '';

  if (!current) failTo('Enter your current password to confirm it’s you.');
  if (next.length < 8) failTo('Your new password must be at least 8 characters.');
  if (next !== confirm) failTo('The new password and confirmation don’t match.');
  if (next === current) failTo('Your new password must be different from your current one.');
  if (!me.email) failTo('Your account has no email on file. Contact an administrator.');

  // Verify identity by re-authenticating with the current password before changing it.
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: me.email as string,
    password: current,
  });
  if (authErr) failTo('That current password is incorrect.');

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) failTo(error.message);

  redirect('/account?success=1');
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const me = await requireAuth();
  const sp = await searchParams;
  const back = homeHref(me);

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="mx-auto max-w-xl px-6 py-10 sm:py-14">
        <Link
          href={back}
          className="text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          &larr; Back
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 ring-1 ring-inset ring-gray-200/70">
            <ShieldCheck className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-gray-950">Account &amp; security</h1>
            <p className="text-sm text-gray-500">Manage your sign-in details.</p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {sp.success && (
            <Alert tone="success" title="Password updated.">
              Your password has been changed. Use it the next time you sign in.
            </Alert>
          )}
          {sp.error && <Alert tone="danger" title="Couldn’t update your password.">{sp.error}</Alert>}

          {/* ======== ACCOUNT DETAILS ======== */}
          <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Account</h2>
            <dl className="mt-3 divide-y divide-gray-100 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{me.email ?? '—'}</dd>
              </div>
              {me.role_name && (
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-gray-500">Role</dt>
                  <dd className="font-medium text-gray-900">{me.role_name}</dd>
                </div>
              )}
              {me.portfolio?.company_name && (
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-gray-500">Company</dt>
                  <dd className="font-medium text-gray-900">{me.portfolio.company_name}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-xs text-gray-400">
              To change your email, contact an administrator.
            </p>
          </section>

          {/* ======== CHANGE PASSWORD ======== */}
          <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Change password</h2>
            <form action={changePassword} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="current_password">Current password</Label>
                <Input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
              </div>
              <div>
                <Label htmlFor="new_password">New password</Label>
                <Input id="new_password" name="new_password" type="password" autoComplete="new-password" required minLength={8} />
                <p className="mt-1 text-xs text-gray-400">At least 8 characters.</p>
              </div>
              <div>
                <Label htmlFor="confirm_password">Confirm new password</Label>
                <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required minLength={8} />
              </div>
              <div className="flex justify-end pt-1">
                <Button type="submit">Update password</Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
