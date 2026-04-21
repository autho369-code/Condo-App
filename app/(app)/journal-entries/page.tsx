import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function JournalEntriesPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('journal_entries')
    .select('id, entry_date, reference_number, memo, source_type, posted, posted_at')
    .order('entry_date', { ascending: false })
    .limit(100);

  return (
    <ModulePage title="Journal Entries" description="All posted and draft journal entries across the portfolio (last 100).">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Date</TH><TH>Ref #</TH><TH>Memo</TH><TH>Source</TH><TH>Status</TH></TR></THead>
          <tbody>
            {rows.map((j: any) => (
              <TR key={j.id}>
                <TD className="whitespace-nowrap text-sm">{date(j.entry_date)}</TD>
                <TD className="font-mono text-xs text-gray-600">{j.reference_number ?? '—'}</TD>
                <TD className="max-w-md truncate">{j.memo ?? '—'}</TD>
                <TD className="text-xs capitalize text-gray-500">{j.source_type?.replace(/_/g, ' ') ?? 'manual'}</TD>
                <TD>
                  {j.posted
                    ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">posted</span>
                    : <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">draft</span>}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">No journal entries posted.</p>
      )}
    </ModulePage>
  );
}
