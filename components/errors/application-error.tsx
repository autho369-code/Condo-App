'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isRecoverableClientBundleError, shouldReloadForClientBundleError } from '@/lib/errors/client-bundle-recovery';

export function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);
  const staleBundle = isRecoverableClientBundleError(error);

  useEffect(() => {
    console.error('[Portier369] Client error boundary', {
      name: error.name,
      message: error.message,
      digest: error.digest,
    });

    if (!staleBundle) return;

    try {
      if (shouldReloadForClientBundleError(error, window.sessionStorage)) {
        setRecovering(true);
        const fallbackTimer = window.setTimeout(() => setRecovering(false), 5_000);
        window.location.reload();
        return () => window.clearTimeout(fallbackTimer);
      }
    } catch {
      // Storage may be unavailable in hardened browser modes. In that case,
      // show the manual recovery action instead of risking a reload loop.
    }
  }, [error, staleBundle]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-gray-200/70 bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-9">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
          {recovering ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ShieldAlert className="h-5 w-5" />}
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Portier369 workspace</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-gray-950">
          {recovering ? 'Applying the latest update' : 'We could not load this workspace'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {staleBundle
            ? 'A newer version of Portier369 is available. Reload the application to continue securely.'
            : 'Your session and saved work are safe. Try this page again, or reload the application if the issue continues.'}
        </p>

        {!recovering ? (
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" />
              Reload application
            </Button>
            <Button variant="secondary" onClick={reset}>Try this page again</Button>
          </div>
        ) : null}

        {error.digest ? <p className="mt-6 text-xs text-gray-400">Reference: {error.digest}</p> : null}
      </section>
    </main>
  );
}
