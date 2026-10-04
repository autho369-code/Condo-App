import { Alert, Breadcrumb, PageHeader, PageShell } from '@/components/ui/shell';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import { RecurringJournalEntryForm } from '../recurring-je-form';

export const dynamic = 'force-dynamic';

export default async function NewRecurringJournalEntryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const [{ rows: gls }, { rows: associations }] = await Promise.all([
    fetchAllRows<any>(() => db.from('gl_accounts').select('id, number, name, associations!gl_accounts_association_id_fkey(name)').eq('active', true).order('number').order('id')),
    fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id')),
  ]);

  return (
    <PageShell className="max-w-5xl">
      <Breadcrumb items={[{ label: 'Journal entries', href: '/journal-entries' }, { label: 'Recurring', href: '/journal-entries/recurring' }, { label: 'New' }]} />
      <PageHeader
        title="New recurring journal entry"
        description="Posted automatically on each scheduled date — for depreciation, reserve allocations, prepaid amortization and similar entries."
      />
      {sp.error && <div className="mb-6"><Alert tone="danger" title="Could not save">{sp.error}</Alert></div>}
      <RecurringJournalEntryForm gls={gls} associations={associations} today={todayInZone()} />
    </PageShell>
  );
}
