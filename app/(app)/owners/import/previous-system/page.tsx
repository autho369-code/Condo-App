import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
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
// Imports run as server actions of this page. Keep this well under the 15-minute import
// lock window (lib/imports/import-lock.ts) so a lock can never expire while its import runs.
export const maxDuration = 300;

export default async function AppfolioImportPage() {
  const me = await requireStaff();
  // The chart of accounts, open balances and trial balance need finance access (the actions re-check).
  const canFinance = Boolean(me.is_finance_staff || me.is_platform_operator);
  // The chart of accounts, vendors and trial-balance check work on the user's own company;
  // an operator with no company of their own can't use them, so they aren't shown.
  const hasCompany = Boolean(me.portfolio?.id);
  const supabase = await createClient();
  // Paged: PostgREST returns at most 1,000 rows, and every association must be selectable.
  const { rows: associations } = await fetchAllRows<{ id: string; name: string }>(() => (supabase as any)
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name')
    .order('id'));

  return (
    <DataWorkspace
      title="Import from your previous system"
      description="Bring associations over from your previous system's report exports, top to bottom: units, homeowners, chart of accounts, vendors, open balances and work orders, then tie out the trial balance. Nothing is saved until you review the preview and choose Import."
      actions={<Link href="/owners/import"><Button variant="secondary">Other imports</Button></Link>}
    >
      <div className="max-w-5xl space-y-8">
        <AppfolioImportClient associations={associations} importUnits={importAppfolioUnits} />
        <HomeownerImportSection associations={associations} importHomeowners={importAppfolioHomeowners} />
        {canFinance && hasCompany && <GlImportSection importChartOfAccounts={importAppfolioChartOfAccounts} />}
        {hasCompany && <VendorImportSection associations={associations} importVendors={importAppfolioVendors} />}
        {canFinance && <ReceivablesImportSection associations={associations} importReceivables={importAppfolioReceivables} />}
        <WorkOrderImportSection associations={associations} importWorkOrders={importAppfolioWorkOrders} />
        {canFinance && hasCompany && (
          <TrialBalanceTieOutSection associations={associations} tieOutTrialBalance={tieOutAppfolioTrialBalance} />
        )}
      </div>
    </DataWorkspace>
  );
}
