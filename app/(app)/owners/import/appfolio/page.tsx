import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { importAppfolioUnits } from '../actions';
import { AppfolioImportClient } from './appfolio-client';
import { importAppfolioChartOfAccounts, tieOutAppfolioTrialBalance } from './gl-actions';
import { importAppfolioHomeowners } from './homeowner-actions';
import { HomeownerImportSection } from './homeowner-section';
import { GlImportSection, TrialBalanceTieOutSection } from './gl-section';
import { importAppfolioReceivables } from './receivables-actions';
import { ReceivablesImportSection } from './receivables-section';
import { importAppfolioVendors } from './vendor-actions';
import { VendorImportSection } from './vendor-section';
import { importAppfolioWorkOrders } from './work-order-actions';
import { WorkOrderImportSection } from './work-order-section';

export const dynamic = 'force-dynamic';

export default async function AppfolioImportPage() {
  const me = await requireStaff();
  // The chart of accounts, open balances and trial balance need finance access (the actions re-check).
  const canFinance = Boolean(me.is_finance_staff || me.is_platform_operator);
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
      description="Bring associations over from AppFolio's own report exports, top to bottom: units, homeowners, chart of accounts, vendors, open balances and work orders, then tie out the trial balance. Nothing is saved until you review the preview and choose Import."
      actions={<Link href="/owners/import"><Button variant="secondary">Other imports</Button></Link>}
    >
      <div className="max-w-5xl space-y-8">
        <AppfolioImportClient associations={associations} importUnits={importAppfolioUnits} />
        <HomeownerImportSection associations={associations} importHomeowners={importAppfolioHomeowners} />
        {canFinance && <GlImportSection importChartOfAccounts={importAppfolioChartOfAccounts} />}
        <VendorImportSection importVendors={importAppfolioVendors} />
        {canFinance && <ReceivablesImportSection associations={associations} importReceivables={importAppfolioReceivables} />}
        <WorkOrderImportSection associations={associations} importWorkOrders={importAppfolioWorkOrders} />
        {canFinance && (
          <TrialBalanceTieOutSection associations={associations} tieOutTrialBalance={tieOutAppfolioTrialBalance} />
        )}
      </div>
    </DataWorkspace>
  );
}
