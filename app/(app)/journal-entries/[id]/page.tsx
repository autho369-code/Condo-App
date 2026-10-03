import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Alert } from '@/components/ui/shell';
import { Field, Input } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { StatusChip } from '@/components/operations/status-chip';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { reverseJournalEntry } from '@/lib/rpcs/journal-entries';
import { todayInZone } from '@/lib/time/zoned';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Entries that can be reversed here; everything else belongs to a record
// (receipt, bill, check, transfer…) and is voided from that record.
const REVERSIBLE = new Set(['manual', 'adjustment', 'recurring_je', 'je_batch', 'bank_deposit']);
const SOURCE_LABEL: Record<string, string> = {
  recurring_je: 'Recurring journal entry',
  je_batch: 'Uploaded batch',
  je_reversal: 'Reversing entry',
  bank_deposit: 'Other deposit',
  payment: 'Homeowner receipt',
  charge: 'Homeowner charge',
  payable_bill: 'Bill',
  check_payment: 'Bill payment',
  bank_transfer: 'Bank transfer',
  bank_transaction: 'Bank feed',
};

export default async function JournalEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; reversal?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { data: je } = await db
    .from('journal_entries')
    .select('id, entry_date, reference_number, description, memo, source_type, source_id, posted, posted_at, batch_id, reversed_by_entry_id, created_at, journal_lines(id, debit_amount, credit_amount, memo, sort_order, associations(name), gl_accounts(number, name))')
    .eq('id', id)
    .maybeSingle();
  if (!je) notFound();
  const lines = ((je.journal_lines ?? []) as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit_amount ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit_amount ?? 0), 0);
  const reversible = je.posted && !je.reversed_by_entry_id && (je.source_type == null || REVERSIBLE.has(je.source_type));

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<Link href="/journal-entries" className="transition-colors hover:text-gray-700">Journal entries</Link>}
          title={je.description ?? je.memo ?? 'Journal entry'}
        />
      }
    >
      {sp.error && <Alert tone="danger" title="Could not reverse the entry">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" title="Journal entry posted" />}
      {sp.reversal && <Alert tone="success" title="Reversing entry posted">This entry cancels the original.</Alert>}

      <Section
        title="Details"
        actions={je.reversed_by_entry_id ? <StatusChip tone="neutral">Reversed</StatusChip> : je.posted ? <StatusChip tone="success">Posted</StatusChip> : <StatusChip tone="warning">Draft</StatusChip>}
        padded
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Date</dt><dd className="text-gray-900">{date(je.entry_date)}</dd></div>
          <div><dt className="text-gray-500">Reference</dt><dd className="font-mono text-gray-900">{je.reference_number ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Source</dt><dd className="text-gray-900">{je.source_type ? SOURCE_LABEL[je.source_type] ?? je.source_type.replace(/_/g, ' ') : 'Manual entry'}</dd></div>
          <div><dt className="text-gray-500">Posted</dt><dd className="text-gray-900">{je.posted_at ? date(je.posted_at) : '—'}</dd></div>
          {je.memo && <div className="sm:col-span-2"><dt className="text-gray-500">Memo</dt><dd className="text-gray-900">{je.memo}</dd></div>}
          {je.source_type === 'je_reversal' && je.source_id && (
            <div><dt className="text-gray-500">Reverses</dt><dd><Link href={`/journal-entries/${je.source_id}`} className="font-medium hover:underline">Original entry</Link></dd></div>
          )}
          {je.reversed_by_entry_id && (
            <div><dt className="text-gray-500">Reversed by</dt><dd><Link href={`/journal-entries/${je.reversed_by_entry_id}`} className="font-medium hover:underline">Reversing entry</Link></dd></div>
          )}
          {je.batch_id && (
            <div><dt className="text-gray-500">Batch</dt><dd><Link href={`/journal-entries?tab=history&batch_id=${je.batch_id}`} className="font-medium hover:underline">Entries in this upload</Link></dd></div>
          )}
        </dl>
      </Section>

      <Section title="Lines">
        <Table>
          <THead>
            <tr>
              <TH>GL account</TH>
              <TH>Association</TH>
              <TH>Memo</TH>
              <TH className="text-right">Debit</TH>
              <TH className="text-right">Credit</TH>
            </tr>
          </THead>
          <tbody>
            {lines.map((l) => (
              <TR key={l.id}>
                <TD>{l.gl_accounts ? `${l.gl_accounts.number} · ${l.gl_accounts.name}` : '—'}</TD>
                <TD>{l.associations?.name ?? '—'}</TD>
                <TD className="text-gray-600">{l.memo ?? '—'}</TD>
                <TD className="text-right tabular-nums">{Number(l.debit_amount) ? money(l.debit_amount) : ''}</TD>
                <TD className="text-right tabular-nums">{Number(l.credit_amount) ? money(l.credit_amount) : ''}</TD>
              </TR>
            ))}
            <TR>
              <TD className="font-medium" colSpan={3}>Total</TD>
              <TD className="text-right font-semibold tabular-nums">{money(totalDebit)}</TD>
              <TD className="text-right font-semibold tabular-nums">{money(totalCredit)}</TD>
            </TR>
          </tbody>
        </Table>
      </Section>

      {reversible && (
        <Section title="Reverse entry" padded>
          <p className="mb-3 text-sm text-gray-600">Posts an equal and opposite entry on the date you choose. The original stays in the ledger, marked reversed.</p>
          <form action={reverseJournalEntry} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="entry_id" value={je.id} />
            <Field label="Reversal date" htmlFor="reversal_date">
              <Input id="reversal_date" name="reversal_date" type="date" required defaultValue={todayInZone()} />
            </Field>
            <Field label="Reason" htmlFor="reason" className="min-w-64 flex-1">
              <Input id="reason" name="reason" required minLength={3} maxLength={200} placeholder="Posted to the wrong GL account" />
            </Field>
            <PendingSubmit variant="danger" pendingLabel="Reversing…">Reverse entry</PendingSubmit>
          </form>
        </Section>
      )}
      {je.posted && !je.reversed_by_entry_id && !reversible && je.source_type !== 'je_reversal' && (
        <p className="text-sm text-gray-600">This entry was posted by a {SOURCE_LABEL[je.source_type] ?? 'record'}; void or reverse it from that record.</p>
      )}
    </Workspace>
  );
}
