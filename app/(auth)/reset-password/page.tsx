'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Client is created inside the effect (browser only) so build-time
    // prerendering never needs Supabase env vars to render this page.
    let cancelled = false;
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setHasSession(!!session);
      setChecking(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    const { error: updateErr } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (updateErr) {
      setError(updateErr.message || 'Could not update your password. The reset link may have expired — request a new one.');
      return;
    }
    router.push('/account?notice=password_updated');
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-gray-950">
          Choose a new password
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Set a new password for your Portier369 account.
        </p>
      </header>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
        {checking ? (
          <p className="text-sm text-gray-500">Checking your reset link…</p>
        ) : !hasSession ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-5 text-amber-800" role="alert">
              This reset link is invalid or has expired. Request a new one and use it within a few minutes.
            </p>
            <Link href="/forgot-password" className="block text-center text-sm font-medium text-gray-900 underline-offset-4 hover:underline">
              Request a new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" disabled={saving} className="h-11 w-full rounded-xl bg-gray-950 text-[14px] hover:bg-gray-800">
              {saving ? 'Saving…' : 'Set new password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
