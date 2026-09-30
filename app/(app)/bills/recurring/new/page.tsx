import { Alert, Breadcrumb, PageHeader, PageShell } from '@/components/ui/shell';
import { RecurringBillForm, loadRecurringBillOptions } from '@/components/bills/recurring-bill-form';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewRecurringBillPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const options = await loadRecurringBillOptions(await createClient());
  return (
    <PageShell className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Payables', href: '/bills' }, { label: 'Recurring bills', href: '/bills/recurring' }, { label: 'New' }]} />
      <PageHeader title="New recurring bill" />
      {sp.error && <div className="mb-6"><Alert tone="danger" title="Could not save">{sp.error}</Alert></div>}
      <RecurringBillForm values={{}} {...options} />
    </PageShell>
  );
}
