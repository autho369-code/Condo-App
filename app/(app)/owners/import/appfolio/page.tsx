import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { importAppfolioUnits } from '../actions';
import { AppfolioImportClient } from './appfolio-client';

export const dynamic = 'force-dynamic';

export default async function AppfolioImportPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  return (
    <DataWorkspace
      title="Import from AppFolio"
      description="Bring an association's units over from AppFolio's own report exports. Nothing is saved until you review the preview and choose Import."
      actions={<Link href="/owners/import"><Button variant="secondary">Other imports</Button></Link>}
    >
      <AppfolioImportClient
        associations={(associations ?? []) as { id: string; name: string }[]}
        importUnits={importAppfolioUnits}
      />
    </DataWorkspace>
  );
}
