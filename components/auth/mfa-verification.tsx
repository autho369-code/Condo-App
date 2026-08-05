'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { safeInternalNext } from '@/lib/security/redirects';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';

type Step = 'loading' | 'setup' | 'enroll' | 'challenge' | 'active' | 'error';

interface EnrollmentDetails {
  qrCode: string;
  secret: string;
}

async function persistVerifiedFactor() {
  try {
    const response = await fetch('/api/auth/mfa-complete', { method: 'POST' });
    if (!response.ok) console.error('Unable to record verified MFA status.');
  } catch {
    console.error('Unable to record verified MFA status.');
  }
}

export function MfaVerification({
  next,
  required,
  manage = false,
  initialError,
}: {
  next: string;
  required: boolean;
  manage?: boolean;
  initialError?: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const destination = safeInternalNext(next) ?? '/';
  const [step, setStep] = useState<Step>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentDetails | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(
    initialError === 'verification_unavailable'
      ? 'We could not verify your security status. Try again.'
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      if (assurance.error) {
        setError('We could not load your two-step verification status. Try again.');
        setStep('error');
        return;
      }
      if (assurance.data.currentLevel === 'aal2') {
        await persistVerifiedFactor();
        if (required && !manage) {
          router.replace(destination);
          router.refresh();
        } else {
          setStep('active');
        }
        return;
      }

      const factors = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (factors.error) {
        setError('We could not load your authenticator. Try again.');
        setStep('error');
        return;
      }

      const verifiedFactor = factors.data.totp[0];
      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
        setStep('challenge');
      } else {
        setStep('setup');
      }
    }

    void load();
    return () => { active = false; };
  }, [destination, manage, required, retryKey, router, supabase]);

  async function startEnrollment() {
    setBusy(true);
    setError(null);

    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) {
      setError('We could not start authenticator setup. Try again.');
      setBusy(false);
      return;
    }

    // A refreshed or abandoned setup can leave an unusable unverified factor.
    // Clear only those stale factors before generating a fresh QR code.
    for (const factor of factors.data.all) {
      if (factor.factor_type === 'totp' && factor.status === 'unverified') {
        const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) {
          setError('We could not clear an incomplete authenticator setup. Try again or contact support.');
          setBusy(false);
          return;
        }
      }
    }

    const result = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Portier369 Authenticator',
    });
    if (result.error) {
      setError(result.error.message || 'We could not start authenticator setup.');
      setBusy(false);
      return;
    }

    setFactorId(result.data.id);
    setEnrollment({
      qrCode: result.data.totp.qr_code,
      secret: result.data.totp.secret,
    });
    setCode('');
    setStep('enroll');
    setBusy(false);
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) {
      setError('Your authenticator could not be found. Start setup again or contact support.');
      setStep('setup');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setBusy(true);
    setError(null);
    const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error) {
      setError('That code was not accepted. Wait for a new code and try again.');
      setCode('');
      setBusy(false);
      codeRef.current?.focus();
      return;
    }

    await persistVerifiedFactor();
    if (required && !manage) {
      router.replace(destination);
      router.refresh();
    } else {
      setStep('active');
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  async function copySecret() {
    if (!enrollment?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
    } catch {
      setError('Copy was unavailable. Select the setup key and copy it manually.');
    }
  }

  if (step === 'loading') {
    return (
      <div className="flex min-h-40 items-center justify-center" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="sr-only">Loading security status</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div id="mfa-verification-error" aria-live="polite" aria-atomic="true">
        {error && <Alert title="Verification problem">{error}</Alert>}
      </div>

      {step === 'error' && (
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            setError(null);
            setStep('loading');
            setRetryKey((value) => value + 1);
          }}
        >
          Try again
        </Button>
      )}

      {step === 'setup' && (
        <div className="space-y-4">
          <Alert tone="info" className="p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold">Protect this account</p>
                <p className="mt-1 text-blue-800">
                  Use Microsoft Authenticator, Google Authenticator, 1Password, or another TOTP app. No phone number is required.
                </p>
              </div>
            </div>
          </Alert>
          <Button type="button" className="w-full" onClick={startEnrollment} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Set up authenticator
          </Button>
        </div>
      )}

      {step === 'enroll' && enrollment && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
            <Image
              src={enrollment.qrCode}
              alt="QR code for Portier369 authenticator setup"
              width={208}
              height={208}
              unoptimized
              className="mx-auto rounded-lg bg-white p-2"
            />
            <p className="mt-3 text-xs leading-5 text-gray-500">
              Scan the QR code. If you cannot scan it, enter this setup key:
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-left text-xs font-semibold tracking-wide text-gray-800">
                {enrollment.secret}
              </code>
              <Button type="button" variant="secondary" size="sm" onClick={copySecret}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          <VerificationForm code={code} setCode={setCode} busy={busy} onSubmit={verifyCode} submitLabel="Verify and continue" inputRef={codeRef} hasError={Boolean(error)} />
        </div>
      )}

      {step === 'challenge' && (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-gray-600">
            Open your authenticator app and enter the current 6-digit code to continue.
          </p>
          <VerificationForm code={code} setCode={setCode} busy={busy} onSubmit={verifyCode} submitLabel="Verify identity" inputRef={codeRef} hasError={Boolean(error)} autoFocus />
        </div>
      )}

      {step === 'active' && (
        <div className="space-y-4">
          <Alert tone="success" className="p-4">
            <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Two-step verification is active</p>
              <p className="mt-1 text-[13px] leading-5 text-emerald-800">This session has passed authenticator verification.</p>
            </div>
            </div>
          </Alert>
          <Button type="button" className="w-full" onClick={() => router.replace(destination)}>
            Continue
          </Button>
        </div>
      )}

      <Button type="button" variant="ghost" className="w-full text-gray-500" onClick={signOut} disabled={busy}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}

function VerificationForm({
  code,
  setCode,
  busy,
  onSubmit,
  submitLabel,
  inputRef,
  hasError,
  autoFocus = false,
}: {
  code: string;
  setCode: (value: string) => void;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  hasError: boolean;
  autoFocus?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="mfa-code">Authenticator code</Label>
        <Input
          ref={inputRef}
          id="mfa-code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus={autoFocus}
          className="h-12 text-center text-lg font-semibold tracking-[0.35em]"
          aria-describedby={`mfa-code-hint${hasError ? ' mfa-verification-error' : ''}`}
          aria-invalid={hasError}
        />
        <p id="mfa-code-hint" className="mt-1.5 text-xs text-gray-400">Codes refresh every 30 seconds.</p>
      </div>
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
