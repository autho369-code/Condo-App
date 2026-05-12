import Link from 'next/link';
import { AccountingPage } from '@/components/accounting/accounting-page';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { manuallyPostJournalEntries } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ManualPostJournalEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string }>;
}) {
  await requireStaff();
  const { posted } = await searchParams;
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('journal_entries')
    .select('id, entry_date, reference_number, description, memo, source_type, created_at')
    .eq('posted', false)
    .order('entry_date', { ascending: true })
    .limit(100);

  return (
    <AccountingPage active="journal-entries" title="Manually Post Journal Entries">
      <div className="space-y-4">
        {posted !== undefined && (
          <div className="border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-900">
            Posted {posted} journal entr{posted === '1' ? 'y' : 'ies'}.
          </div>
        )}

        {rows && rows.length > 0 ? (
          <form action={manuallyPostJournalEntries} className="space-y-4">
            <Table>
              <THead>
                <TR><TH></TH><TH>Date</TH><TH>Reference</TH><TH>Description</TH><TH>Source</TH></TR>
              </THead>
              <tbody>
                {rows.map((entry: any) => (
                  <TR key={entry.id}>
                    <TD className="w-10">
                      <input type="checkbox" name="entry_ids" value={entry.id} aria-label={`Post ${entry.reference_number ?? entry.id}`} />
                    </TD>
                    <TD className="whitespace-nowrap">{date(entry.entry_date)}</TD>
                    <TD className="font-mono text-xs text-ink-600">{entry.reference_number ?? '-'}</TD>
                    <TD>
                      <div className="font-medium text-ink-900">{entry.description ?? entry.memo ?? '-'}</div>
                      <div className="text-xs text-ink-500">Created {date(entry.created_at)}</div>
                    </TD>
                    <TD className="capitalize">{entry.source_type?.replace(/_/g, ' ') ?? 'manual'}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>

            <div className="flex justify-end gap-2">
              <Link href="/journal-entries" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
              <Button type="submit">Post Selected Entries</Button>
            </div>
          </form>
        ) : (
          <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No draft journal entries found.</p>
        )}
      </div>
    </AccountingPage>
  );
}
