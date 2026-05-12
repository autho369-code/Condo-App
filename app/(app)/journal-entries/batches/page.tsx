import Link from 'next/link';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function JournalEntryBatchesPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('journal_entry_batches')
    .select('id, name, description, status, total_entries, total_debit, total_credit, posted_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Journal Entry Batches</h1>
          <Link href="/journal-entries/batches/new" className="border border-ink-900 bg-white px-3 py-1.5 text-xs text-ink-900">Upload Journal Entry Batch</Link>
        </div>

        <Table>
          <THead><TR><TH>Batch</TH><TH>Created</TH><TH>Entries</TH><TH className="text-right">Debits</TH><TH className="text-right">Credits</TH><TH>Status</TH></TR></THead>
          <tbody>
            {(rows ?? []).map((row: any) => (
              <TR key={row.id}>
                <TD><div className="font-medium">{row.name}</div><div className="text-xs text-ink-500">{row.description ?? '-'}</div></TD>
                <TD>{date(row.created_at)}</TD>
                <TD>{row.total_entries}</TD>
                <TD className="text-right">{money(row.total_debit)}</TD>
                <TD className="text-right">{money(row.total_credit)}</TD>
                <TD><span className="bg-ink-100 px-2 py-0.5 text-[10px] font-medium uppercase text-ink-700">{row.status}</span></TD>
              </TR>
            ))}
            {(rows ?? []).length === 0 && (
              <TR><TD colSpan={6} className="text-center text-sm text-ink-500">No journal entry batches found.</TD></TR>
            )}
          </tbody>
        </Table>
      </main>
    </div>
  );
}
