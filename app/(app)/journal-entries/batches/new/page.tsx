import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createJournalEntryBatch } from '@/lib/rpcs/accounting';

export const dynamic = 'force-dynamic';

export default async function NewJournalEntryBatchPage() {
  await requireStaff();

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Upload Journal Entry Batch</h1>
          <Link href="/journal-entries/batches" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={createJournalEntryBatch} className="space-y-4 border border-ink-100 bg-white p-5">
          <Field label="Batch Name"><Input name="name" required /></Field>
          <Field label="Upload URL"><Input name="upload_url" placeholder="Storage URL or import file reference" /></Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Entries"><Input name="total_entries" type="number" min="0" defaultValue="0" /></Field>
            <Field label="Total Debit"><Input name="total_debit" inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Total Credit"><Input name="total_credit" inputMode="decimal" placeholder="0.00" /></Field>
          </div>
          <Field label="Description"><textarea name="description" rows={3} className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm" /></Field>

          <div className="flex justify-end gap-2">
            <Link href="/journal-entries/batches" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit">Save Batch</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
