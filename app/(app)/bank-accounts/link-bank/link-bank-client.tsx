'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Landmark, XCircle } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { createClient } from '@/lib/supabase/client';

type BankAccount = {
  id: string;
  name: string;
  bank_name: string | null;
};

type PlaidMetadata = {
  institution?: {
    institution_id?: string;
    name?: string;
  };
};

declare global {
  interface Window {
    Plaid: {
      create: (config: {
        token: string;
        onSuccess: (publicToken: string, metadata: PlaidMetadata) => Promise<void>;
        onExit: () => void;
        onLoad: () => void;
      }) => { open: () => void };
    };
  }
}

export function LinkBankClient({ configured }: { configured: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankAccountId = searchParams.get('bank_account_id');
  const [step, setStep] = useState<'select' | 'connect' | 'success' | 'error'>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState(bankAccountId || '');

  useEffect(() => {
    if (!configured) return;

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('bank_accounts')
        .select('id, name, bank_name')
        .is('archived_at', null)
        .order('name');
      setBankAccounts((data || []) as BankAccount[]);
    }

    void load();
  }, [configured]);

  const handleConnect = useCallback(async () => {
    if (!configured) return;

    setLoading(true);
    setError(null);

    try {
      const tokenResponse = await fetch('/api/plaid/create-link-token', { method: 'POST' });
      if (!tokenResponse.ok) {
        const body = await tokenResponse.json();
        throw new Error(body.error || 'Failed to start the bank connection.');
      }
      const { link_token: linkToken } = await tokenResponse.json();
      setStep('connect');

      if (!window.Plaid) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load the secure bank connection.'));
          document.head.appendChild(script);
        });
      }

      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: async (publicToken, metadata) => {
          setLoading(true);
          try {
            const exchangeResponse = await fetch('/api/plaid/exchange-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                public_token: publicToken,
                institution_id: metadata.institution?.institution_id,
                institution_name: metadata.institution?.name,
                bank_account_id: selectedBankAccount || null,
              }),
            });
            if (!exchangeResponse.ok) {
              const body = await exchangeResponse.json();
              throw new Error(body.error || 'Failed to link the bank account.');
            }
            const result = await exchangeResponse.json();
            setInstitutionName(result.institution_name);
            setStep('success');
          } catch (connectionError) {
            setError(connectionError instanceof Error ? connectionError.message : 'Failed to link the bank account.');
            setStep('error');
          } finally {
            setLoading(false);
          }
        },
        onExit: () => {
          setStep('select');
          setLoading(false);
        },
        onLoad: () => setLoading(false),
      });
      handler.open();
    } catch (connectionError) {
      setError(connectionError instanceof Error ? connectionError.message : 'Failed to start the bank connection.');
      setStep('error');
      setLoading(false);
    }
  }, [configured, selectedBankAccount]);

  if (!configured) {
    return (
      <DataWorkspace
        title="Link bank account"
        description="Secure bank connections and transaction imports."
      >
        <div className="mx-auto max-w-lg space-y-5 py-8">
          <Surface className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Landmark className="h-6 w-6" />
            </div>
            <h2 className="text-[15px] font-semibold text-gray-950">Bank connections are not enabled</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Online bank linking is unavailable until Portier369 finishes its banking-provider setup. You can still
              maintain bank accounts and reconcile transactions manually.
            </p>
            <Alert tone="warning" className="mt-5 text-left">
              No bank credentials are requested or transmitted while this service is unavailable.
            </Alert>
            <Link href="/bank-accounts" className="mt-5 inline-flex">
              <Button variant="secondary">Back to bank accounts</Button>
            </Link>
          </Surface>
        </div>
      </DataWorkspace>
    );
  }

  return (
    <DataWorkspace
      title="Link bank account"
      description="Securely connect your bank to Portier369. Transactions will auto-import for reconciliation."
    >
      <div className="mx-auto max-w-lg space-y-6 py-8">
        {step === 'select' && (
          <div className="space-y-6">
            <Surface>
              <SectionTitle
                title="Connect your bank"
                description="Plaid securely links the account. Portier369 never stores your online-banking credentials."
              />
              {!bankAccountId && (
                <Field label="Link to existing bank account (optional)">
                  <Select value={selectedBankAccount} onChange={(event) => setSelectedBankAccount(event.target.value)}>
                    <option value="">Create new bank account</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} {account.bank_name ? `(${account.bank_name})` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </Surface>
            <Button onClick={handleConnect} disabled={loading} size="lg" className="w-full">
              {loading ? 'Connecting...' : 'Connect bank securely'}
            </Button>
          </div>
        )}

        {step === 'connect' && (
          <Surface className="text-center text-sm text-gray-500">Opening the secure bank connection...</Surface>
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
              <Button onClick={() => router.push('/bank-accounts/feeds')}>Import transactions</Button>
              <Button variant="secondary" onClick={() => router.push('/bank-accounts')}>Back to accounts</Button>
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
            <Button variant="secondary" className="mt-5" onClick={() => setStep('select')}>Try again</Button>
          </Surface>
        )}
      </div>
    </DataWorkspace>
  );
}
