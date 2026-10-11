import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { buttonClass } from '@/components/ui/button';
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
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/owners/import/previous-system" className={buttonClass()}>Import from previous system</Link>
          <Link href="/owners" className={buttonClass('secondary')}>Back to owners</Link>
        </div>
      }
    >
      <ImportClient
        associations={(associations ?? []) as { id: string; name: string }[]}
        importOwners={importOwners}
        importOpeningBalances={importOpeningBalances}
      />
    </DataWorkspace>
  );
}
