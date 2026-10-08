import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { importAppfolioUnits } from '../actions';
import { AppfolioImportClient } from './appfolio-client';
import { importAppfolioReceivables } from './receivables-actions';
import { ReceivablesImportSection } from './receivables-section';
import { importAppfolioVendors } from './vendor-actions';
import { VendorImportSection } from './vendor-section';

export const dynamic = 'force-dynamic';

export default async function AppfolioImportPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');
  const associations = (data ?? []) as { id: string; name: string }[];

  return (
    <DataWorkspace
      title="Import from AppFolio"
      description="Bring associations over from AppFolio's own report exports, in this order: units, vendors, then open balances. Nothing is saved until you review the preview and choose Import."
      actions={<Link href="/owners/import"><Button variant="secondary">Other imports</Button></Link>}
    >
      <div className="max-w-5xl space-y-8">
        <AppfolioImportClient associations={associations} importUnits={importAppfolioUnits} />
        <VendorImportSection importVendors={importAppfolioVendors} />
        <ReceivablesImportSection associations={associations} importReceivables={importAppfolioReceivables} />
      </div>
    </DataWorkspace>
  );
}
