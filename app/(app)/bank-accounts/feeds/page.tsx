import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BankFeedsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('id, name, bank_name, auto_reconciliation, last_reconciliation_date')
    .is('archived_at', null)
    .order('name');

  const linked = (accounts ?? []).filter((account: any) => account.auto_reconciliation).length;

  return (
    <DataWorkspace
      title="Bank feed"
      description="Monitor linked accounts, imported transaction readiness, and provider setup without starting external linking automatically."
      rail={<p className="text-sm leading-6 text-gray-600">Provider linking should require staff confirmation before leaving the app.</p>}
    >
      <div className="space-y-6">
        <MetricStrip metrics={[
          { label: 'Accounts', value: accounts?.length ?? 0 },
          { label: 'Feed enabled', value: linked },
          { label: 'Needs setup', value: (accounts?.length ?? 0) - linked },
          { label: 'Imported queue', value: 0, sublabel: 'No pending imports in this shell' },
        ]} />
        <div className="rounded border border-gray-200 bg-white">
          {(accounts ?? []).map((account: any) => (
            <div key={account.id} className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0">
              <div><div className="font-medium text-gray-900">{account.name}</div><div className="text-xs text-gray-500">{account.bank_name ?? 'Bank not provided'}</div></div>
              <StatusChip tone={account.auto_reconciliation ? 'success' : 'warning'}>{account.auto_reconciliation ? 'Linked' : 'Setup needed'}</StatusChip>
            </div>
          ))}
        </div>
      </div>
    </DataWorkspace>
  );
}
