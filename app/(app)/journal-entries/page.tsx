import { AccountingPage } from '@/components/accounting/accounting-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function JournalEntriesPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('journal_entries')
    .select('id, entry_date, reference_number, memo, source_type, posted, posted_at')
    .order('entry_date', { ascending: false })
    .limit(100);

  return (
    <AccountingPage
      active="journal-entries"
      title="Journal Entries"
      subtabs={[
        { label: 'Journal Entry History', href: '/journal-entries', active: true },
        { label: 'Recurring Journal Entries', href: '/journal-entries/recurring' },
        { label: 'Journal Entry Batches', href: '/journal-entries/batches' },
      ]}
    >
      <div className="space-y-4">
        <form action="/journal-entries" className="border border-brand-500 bg-white px-8 py-5">
          <div className="grid gap-3 text-xs md:grid-cols-[140px_1fr]">
            <label htmlFor="association" className="self-center text-right text-ink-700">Association</label>
            <input id="association" name="association" placeholder="Search by property, group, portfolio, or owner" className="h-8 border border-ink-300 px-2 text-xs" />

            <span />
            <select name="scope" className="h-8 border border-ink-300 bg-white px-2 text-xs">
              <option>Show Active Associations</option>
              <option>Show All Associations</option>
            </select>

            <label htmlFor="gl" className="self-center text-right text-ink-700">GL Accounts</label>
            <input id="gl" name="gl" placeholder="Select GL Accounts" className="h-8 border border-ink-300 px-2 text-xs" />

            <label htmlFor="reference" className="self-center text-right text-ink-700">Reference Number</label>
            <input id="reference" name="reference" placeholder="Search by reference number" className="h-8 border border-ink-300 px-2 text-xs" />

            <label className="self-center text-right text-ink-700">From</label>
            <div className="flex items-center gap-2">
              <input name="from" type="date" className="h-8 border border-ink-300 px-2 text-xs" />
              <span>to</span>
              <input name="to" type="date" className="h-8 border border-ink-300 px-2 text-xs" />
            </div>

            <span />
            <button type="submit" className="h-8 w-fit bg-brand-700 px-4 text-xs font-medium text-white">Search</button>
          </div>
        </form>

        {rows && rows.length > 0 ? (
          <Table>
            <THead><TR><TH>Date</TH><TH>Reference</TH><TH>Memo</TH><TH>Source</TH><TH>Status</TH></TR></THead>
            <tbody>
              {rows.map((entry: any) => (
                <TR key={entry.id}>
                  <TD className="whitespace-nowrap text-sm">{date(entry.entry_date)}</TD>
                  <TD className="font-mono text-xs text-ink-600">{entry.reference_number ?? '-'}</TD>
                  <TD className="max-w-md truncate">{entry.memo ?? '-'}</TD>
                  <TD className="text-xs capitalize text-ink-500">{entry.source_type?.replace(/_/g, ' ') ?? 'manual'}</TD>
                  <TD>
                    {entry.posted
                      ? <span className="bg-green-100 px-2 py-0.5 text-xs text-green-700">posted</span>
                      : <span className="bg-amber-100 px-2 py-0.5 text-xs text-champagne-700">draft</span>}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No journal entries found.</p>
        )}
      </div>
    </AccountingPage>
  );
}
