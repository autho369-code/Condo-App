import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BankReconcilePage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: accounts } = await (supabase as any).from('bank_accounts').select('id, name').is('archived_at', null).order('name');

  return (
    <DataWorkspace
      title="Bank reconciliation"
      description="Statement inputs, cleared balances, deposits, checks, notes, and attachments in one reconciliation workspace."
      rail={<p className="text-sm leading-6 text-ink-600">Reconcile only after statement balance and cleared transactions match.</p>}
    >
      <div className="space-y-6">
        <section className="rounded border border-ink-100 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm font-medium text-ink-700 md:col-span-2">Account<select className="mt-1 h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">{(accounts ?? []).map((row: any) => <option key={row.id}>{row.name}</option>)}</select></label>
            <label className="text-sm font-medium text-ink-700">Ending balance<input className="mt-1 h-10 w-full rounded border border-ink-200 px-3 text-sm" placeholder="$0.00" /></label>
            <label className="text-sm font-medium text-ink-700">Statement date<input type="date" className="mt-1 h-10 w-full rounded border border-ink-200 px-3 text-sm" /></label>
          </div>
        </section>
        <MetricStrip metrics={[
          { label: 'Ending balance', value: money(0) },
          { label: 'Cleared balance', value: money(0) },
          { label: 'Adjusted cash balance', value: money(0) },
          { label: 'Difference', value: money(0), sublabel: 'Ready when zero' },
        ]} />
        <WorkspaceTable title="Deposits and other credits" />
        <WorkspaceTable title="Checks and other payments" />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary">Save draft</Button><Button type="button">Reconcile</Button></div>
      </div>
    </DataWorkspace>
  );
}

function WorkspaceTable({ title }: { title: string }) {
  return (
    <section className="rounded border border-ink-100 bg-white">
      <div className="border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-900">{title}</div>
      <div className="px-4 py-8 text-center text-sm text-ink-500">Transactions will appear after selecting an account and statement period.</div>
    </section>
  );
}
