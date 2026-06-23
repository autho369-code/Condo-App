import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { importOwners, importOpeningBalances } from './actions';
import { ImportClient } from './import-client';

export const dynamic = 'force-dynamic';

export default async function ImportDataPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  return (
    <DataWorkspace
      title="Import Data"
      description="Onboard an association in bulk from CSV: import owners, units, and dues, then carry over opening balances — instead of entering each record by hand."
      actions={<Link href="/owners"><Button variant="secondary">Back to owners</Button></Link>}
    >
      <ImportClient
        associations={(associations ?? []) as { id: string; name: string }[]}
        importOwners={importOwners}
        importOpeningBalances={importOpeningBalances}
      />
    </DataWorkspace>
  );
}
