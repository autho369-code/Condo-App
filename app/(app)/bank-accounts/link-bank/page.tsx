'use client';

// Bank connection page using Plaid Link
// /bank-accounts/link-bank

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { Surface, SectionTitle } from '@/components/ui/shell';
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
            <Surface>
              <SectionTitle
                title="Connect your bank"
                description="Portier369 uses Plaid to securely link your bank account. Your login credentials are never stored on our servers."
              />

              {!bankAccountId && (
                <Field label="Link to existing bank account (optional)">
                  <Select
                    value={selectedBankAccount}
                    onChange={(e) => setSelectedBankAccount(e.target.value)}
                  >
                    <option value="">Create new bank account</option>
                    {bankAccounts.map((acct: any) => (
                      <option key={acct.id} value={acct.id}>
                        {acct.name} {acct.bank_name ? `(${acct.bank_name})` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {!selectedBankAccount && bankAccounts.length === 0 && (
                <p className="mt-4 text-sm text-amber-600">
                  No bank accounts on file. Plaid will create one automatically from the linked account.
                </p>
              )}
            </Surface>

            <Button onClick={handleConnect} disabled={loading} size="lg" className="w-full">
              {loading ? 'Connecting…' : 'Connect bank via Plaid'}
            </Button>

            <Surface padded={false} className="p-4 text-xs text-gray-500">
              <p className="font-medium text-gray-700">What happens next:</p>
              <ol className="mt-2 list-inside list-decimal space-y-1">
                <li>Plaid securely connects to your bank</li>
                <li>Transactions sync automatically (initially up to 90 days)</li>
                <li>Our auto-match engine assigns GL accounts</li>
                <li>You review and confirm matches on the Bank Feed page</li>
              </ol>
            </Surface>
          </div>
        )}

        {step === 'success' && (
          <Surface className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-[15px] font-semibold text-gray-950">Bank connected</h2>
            <p className="mt-1 text-sm text-gray-500">
              {institutionName || 'Your bank'} has been linked. Transactions will begin syncing.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={handleSync}>Import transactions</Button>
              <Button variant="secondary" onClick={() => router.push('/bank-accounts')}>
                Back to accounts
              </Button>
            </div>
          </Surface>
        )}

        {step === 'error' && (
          <Surface className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <XCircle className="h-6 w-6" />
            </div>
            <h2 className="text-[15px] font-semibold text-gray-950">Connection failed</h2>
            <p className="mt-1 text-sm text-red-700">{error || 'An unknown error occurred.'}</p>
            <Button variant="secondary" className="mt-5" onClick={() => setStep('select')}>
              Try again
            </Button>
          </Surface>
        )}
      </div>
    </DataWorkspace>
  );
}
