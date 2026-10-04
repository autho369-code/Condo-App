import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { requireFinanceStaff } from '@/lib/auth/me';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import { createClient } from '@/lib/supabase/server';
import { claimSubmission, completeSubmission, newSubmissionToken, releaseSubmission, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { JournalEntryForm } from './journal-entry-form';

export const dynamic = 'force-dynamic';

export default async function NewJournalEntryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireFinanceStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ rows: glAccounts }, { rows: associations }] = await Promise.all([
    fetchAllRows<any>(() => db.from('gl_accounts').select('id, number, name, association_id').eq('portfolio_id', me.portfolio?.id).eq('active', true).order('number').order('id')),
    fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id')),
  ]);

  async function createJournalEntry(formData: FormData) {
    'use server';
    await requireFinanceStaff();
    const db = (await createClient()) as any;
    const fail = (m: string): never => redirect('/journal-entries/new?error=' + encodeURIComponent(m));

    const entryDate = String(formData.get('entry_date') ?? '');
    const description = String(formData.get('description') ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) fail('Entry date is required.');
    if (!description) fail('Description is required.');

    const gls = formData.getAll('line_gl').map(String);
    const assocs = formData.getAll('line_assoc').map(String);
    const debits = formData.getAll('line_debit').map(String);
    const credits = formData.getAll('line_credit').map(String);
    const memos = formData.getAll('line_memo').map(String);
    const lines = gls
      .map((gl, i) => ({ gl_account_id: gl, association_id: assocs[i] || null, debit: debits[i] || '0', credit: credits[i] || '0', memo: memos[i] || '' }))
      .filter((l) => l.gl_account_id || Number(l.debit) || Number(l.credit));

    // A double click or re-sent form must not post the entry twice.
    const claim = await claimSubmission(db, formData, 'manual_journal_entry');
    if (claim.status === 'error') fail(claim.message);
    if (claim.status === 'duplicate') {
      if (claim.resultId) redirect(`/journal-entries/${claim.resultId}?saved=1`);
      fail('This entry is already being posted. Check the journal before posting it again.');
    }
    const token = (claim as { token: string }).token;

    // One RPC posts the entry: it re-checks finance access and association
    // scope, that each GL account belongs to the line's association, one of
    // debit/credit per line, and the balance after rounding to cents.
    const { data: entryId, error } = await db.rpc('post_manual_journal_entry', {
      p_entry_date: entryDate,
      p_description: description,
      p_reference: String(formData.get('reference_number') ?? ''),
      p_memo: String(formData.get('memo') ?? ''),
      p_lines: lines,
    });
    if (error) {
      await releaseSubmission(db, token);
      fail(error.message);
    }
    if (typeof entryId === 'string') await completeSubmission(db, token, entryId);
    redirect(`/journal-entries/${entryId}?saved=1`);
  }

  return (
    <DataWorkspace
      title="New Journal Entry"
      description="Create a balanced double-entry journal entry. Debits must equal credits before it can post."
      actions={<Link href="/journal-entries"><Button variant="secondary">Back to journal entries</Button></Link>}
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not post entry">{sp.error}</Alert>}
        {glAccounts.length === 0 ? (
          <Alert tone="warning" title="No GL accounts yet">Add accounts to your chart of accounts first — <Link href="/gl-accounts/new" className="font-medium underline">create a GL account</Link>.</Alert>
        ) : (
          <JournalEntryForm
            glAccounts={glAccounts as any}
            associations={associations as any}
            action={createJournalEntry}
            today={todayInZone()}
            submissionField={SUBMISSION_FIELD}
            submissionToken={newSubmissionToken()}
          />
        )}
      </div>
    </DataWorkspace>
  );
}
