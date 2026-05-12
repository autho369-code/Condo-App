import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { generateRecurringJournalEntries } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function RecurringJournalEntriesPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('recurring_journal_entries')
    .select('id, name, frequency, interval_count, next_post_date, last_generated_at, auto_generate, archived_at')
    .is('archived_at', null)
    .order('next_post_date');

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Recurring Journal Entries</h1>
          <div className="flex gap-2">
            <form action={generateRecurringJournalEntries}>
              <Button type="submit" variant="secondary" size="sm">Generate Due Entries</Button>
            </form>
            <Link href="/journal-entries/recurring/new" className="border border-ink-900 bg-white px-3 py-1.5 text-xs text-ink-900">New Recurring Journal Entry</Link>
          </div>
        </div>

        <Table>
          <THead><TR><TH>Name</TH><TH>Frequency</TH><TH>Next Post Date</TH><TH>Last Generated</TH><TH>Status</TH></TR></THead>
          <tbody>
            {(rows ?? []).map((row: any) => (
              <TR key={row.id}>
                <TD className="font-medium">{row.name}</TD>
                <TD className="capitalize">{row.interval_count > 1 ? `${row.interval_count} ` : ''}{row.frequency}</TD>
                <TD>{date(row.next_post_date)}</TD>
                <TD>{date(row.last_generated_at)}</TD>
                <TD><span className="bg-ink-100 px-2 py-0.5 text-[10px] font-medium uppercase text-ink-700">{row.auto_generate ? 'Auto' : 'Manual'}</span></TD>
              </TR>
            ))}
            {(rows ?? []).length === 0 && (
              <TR><TD colSpan={5} className="text-center text-sm text-ink-500">No recurring journal entries found.</TD></TR>
            )}
          </tbody>
        </Table>
      </main>
    </div>
  );
}
