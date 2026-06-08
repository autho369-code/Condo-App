'use client';

// Bank connection page using Plaid Link
// /bank-accounts/link-bank

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { createClient } from '@/lib/supabase/client';

declare global {
  interface Window {
    Plaid: {
      create: (config: any) => { open: () => void; exit: () => void; destroy: () => void };
    };
  }
}

export default function LinkBankPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankAccountId = searchParams.get('bank_account_id');

  const [step, setStep] = useState<'select' | 'connect' | 'success' | 'error'>('select');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>(bankAccountId || '');

  // Load bank accounts for selection
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('bank_accounts')
        .select('id, name, bank_name, account_number')
        .is('archived_at', null)
        .order('name');
      setBankAccounts(data || []);
    }
    load();
  }, []);

  // Initiate Plaid Link
  const handleConnect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Get link token
      const tokenRes = await fetch('/api/plaid/create-link-token', { method: 'POST' });
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || 'Failed to get link token');
      }
      const { link_token } = await tokenRes.json();
      setLinkToken(link_token);
      setStep('connect');

      // Step 2: Load Plaid Link script dynamically
      if (!window.Plaid) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Plaid Link'));
          document.head.appendChild(script);
        });
      }

      // Step 3: Open Plaid Link
      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: async (public_token: string, metadata: any) => {
          setLoading(true);

          // Exchange public token
          const exchangeRes = await fetch('/api/plaid/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              public_token,
              institution_id: metadata.institution?.institution_id,
              institution_name: metadata.institution?.name,
              bank_account_id: selectedBankAccount || null,
            }),
          });

          if (!exchangeRes.ok) {
            const err = await exchangeRes.json();
            throw new Error(err.error || 'Failed to link bank');
          }

          const result = await exchangeRes.json();
          setInstitutionName(result.institution_name);
          setStep('success');
          setLoading(false);
        },
        onExit: () => {
          if (step !== 'success') {
            setStep('select');
          }
          setLoading(false);
        },
        onLoad: () => setLoading(false),
      });

      handler.open();
    } catch (err: any) {
      setError(err.message);
      setStep('error');
      setLoading(false);
    }
  }, [selectedBankAccount, step]);

  const handleSync = async () => {
    router.push('/bank-accounts/feeds');
  };

  return (
    <DataWorkspace
      title="Link bank account"
      description="Securely connect your bank to Portier369 via Plaid. Transactions will auto-import and match to your GL accounts."
    >
      <div className="mx-auto max-w-lg space-y-6 py-8">
        {step === 'select' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Connect your bank</h2>
              <p className="mt-1 text-sm text-gray-500">
                Portier369 uses Plaid to securely link your bank account. Your login credentials are never stored on our servers.
              </p>

              {!bankAccountId && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Link to existing bank account (optional)
                  </label>
                  <select
                    value={selectedBankAccount}
                    onChange={(e) => setSelectedBankAccount(e.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Create new bank account</option>
                    {bankAccounts.map((acct: any) => (
                      <option key={acct.id} value={acct.id}>
                        {acct.name} {acct.bank_name ? `(${acct.bank_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!selectedBankAccount && bankAccounts.length === 0 && (
                <p className="mt-4 text-sm text-amber-600">
                  No bank accounts on file. Plaid will create one automatically from the linked account.
                </p>
              )}
            </div>

            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full rounded-lg bg-gray-950 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Connecting…' : 'Connect Bank via Plaid'}
            </button>

            <div className="rounded border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
              <p className="font-medium text-gray-700">What happens next:</p>
              <ol className="mt-2 list-inside list-decimal space-y-1">
                <li>Plaid securely connects to your bank</li>
                <li>Transactions sync automatically (initially up to 90 days)</li>
                <li>Our auto-match engine assigns GL accounts</li>
                <li>You review and confirm matches on the Bank Feed page</li>
              </ol>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-emerald-900">Bank connected!</h2>
            <p className="mt-2 text-sm text-emerald-700">
              {institutionName || 'Your bank'} has been linked. Transactions will begin syncing.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={handleSync}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Import transactions
              </button>
              <button
                onClick={() => router.push('/bank-accounts')}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to accounts
              </button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-red-900">Connection failed</h2>
            <p className="mt-2 text-sm text-red-700">{error || 'An unknown error occurred.'}</p>
            <button
              onClick={() => setStep('select')}
              className="mt-4 rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
