import { Suspense } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { isPlaidConfigured } from '@/lib/plaid/client';
import { LinkBankClient } from './link-bank-client';

export const dynamic = 'force-dynamic';

function LinkBankFallback() {
  return (
    <DataWorkspace
      title="Link bank account"
      description="Secure bank connections and transaction imports."
    >
      <div className="mx-auto max-w-lg py-8">
        <Surface className="text-sm text-gray-500">Loading bank connection settings...</Surface>
      </div>
    </DataWorkspace>
  );
}

export default async function LinkBankPage() {
  await requireStaff();

  return (
    <Suspense fallback={<LinkBankFallback />}>
      <LinkBankClient configured={isPlaidConfigured()} />
    </Suspense>
  );
}
