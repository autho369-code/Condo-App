import { notFound } from 'next/navigation';
import { Alert, Breadcrumb, PageHeader, PageShell } from '@/components/ui/shell';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import { RecurringJournalEntryForm } from '../../recurring-je-form';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditRecurringJournalEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const [{ data: entry }, { rows: gls }, { rows: associations }] = await Promise.all([
    db.from('recurring_journal_entries')
      .select('id, name, memo, frequency, interval_count, next_post_date, end_date, auto_generate, template_lines, last_error')
      .eq('id', id).is('archived_at', null).maybeSingle(),
    fetchAllRows<any>(() => db.from('gl_accounts').select('id, number, name, associations!gl_accounts_association_id_fkey(name)').eq('active', true).order('number').order('id')),
    fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id')),
  ]);
  if (!entry) notFound();

  return (
    <PageShell className="max-w-5xl">
      <Breadcrumb items={[{ label: 'Journal entries', href: '/journal-entries' }, { label: 'Recurring', href: '/journal-entries/recurring' }, { label: entry.name }]} />
      <PageHeader title={`Edit ${entry.name}`} description="Changes apply to entries posted from now on; entries already posted are not changed." />
      {sp.error && <div className="mb-6"><Alert tone="danger" title="Could not save">{sp.error}</Alert></div>}
      {entry.last_error && <div className="mb-6"><Alert tone="warning" title="The last posting failed">{entry.last_error}</Alert></div>}
      <RecurringJournalEntryForm entry={entry} gls={gls} associations={associations} today={todayInZone()} />
    </PageShell>
  );
}
