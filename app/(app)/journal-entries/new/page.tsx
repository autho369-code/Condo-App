import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { JournalEntryForm } from './journal-entry-form';

export const dynamic = 'force-dynamic';

export default async function NewJournalEntryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: glAccounts }, { data: associations }] = await Promise.all([
    db.from('gl_accounts').select('id, number, name').eq('portfolio_id', me.portfolio?.id).eq('active', true).order('number'),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);

  async function createJournalEntry(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const db = supabase as any;
    const fail = (m: string) => redirect('/journal-entries/new?error=' + encodeURIComponent(m));

    const entryDate = formData.get('entry_date') as string;
    const description = (formData.get('description') as string)?.trim();
    if (!entryDate) fail('Entry date is required.');
    if (!description) fail('Description is required.');

    const gls = formData.getAll('line_gl') as string[];
    const assocs = formData.getAll('line_assoc') as string[];
    const debits = formData.getAll('line_debit') as string[];
    const credits = formData.getAll('line_credit') as string[];
    const memos = formData.getAll('line_memo') as string[];

    const lines = gls.map((gl, i) => ({
      gl_account_id: gl,
      association_id: assocs[i] || null,
      debit_amount: parseFloat(debits[i]) || 0,
      credit_amount: parseFloat(credits[i]) || 0,
      memo: (memos[i] || '').trim() || null,
    })).filter((l) => l.gl_account_id && (l.debit_amount > 0 || l.credit_amount > 0));

    if (lines.length < 2) fail('Add at least two lines with a GL account and an amount.');
    const totalDebit = lines.reduce((s, l) => s + l.debit_amount, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit_amount, 0);
    if (totalDebit <= 0) fail('Entry total must be greater than zero.');
    if (Math.abs(totalDebit - totalCredit) > 0.001) fail(`Entry is out of balance: debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}.`);

    // Insert as a draft first (balance trigger only fires on post), add lines, then post.
    const { data: entry, error: entryErr } = await db.from('journal_entries').insert({
      portfolio_id: me.portfolio?.id,
      entry_date: entryDate,
      description,
      reference_number: (formData.get('reference_number') as string)?.trim() || null,
      memo: (formData.get('memo') as string)?.trim() || null,
      posted: false,
      created_by: me.auth_user_id,
    }).select('id').single();
    if (entryErr || !entry) fail(entryErr?.message ?? 'Could not create entry.');

    const { error: linesErr } = await db.from('journal_lines').insert(
      lines.map((l, i) => ({ ...l, entry_id: entry.id, sort_order: i })),
    );
    if (linesErr) {
      await db.from('journal_entries').delete().eq('id', entry.id); // roll back the orphan draft
      fail(`Could not save lines: ${linesErr.message}`);
    }

    const { error: postErr } = await db.from('journal_entries').update({ posted: true }).eq('id', entry.id);
    if (postErr) fail(`Saved as draft, but posting failed: ${postErr.message}`);

    redirect('/journal-entries');
  }

  return (
    <DataWorkspace
      title="New Journal Entry"
      description="Create a balanced double-entry journal entry. Debits must equal credits before it can post."
      actions={<Link href="/journal-entries"><Button variant="secondary">Back to journal entries</Button></Link>}
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not post entry">{sp.error}</Alert>}
        {(glAccounts ?? []).length === 0 ? (
          <Alert tone="warning" title="No GL accounts yet">Add accounts to your chart of accounts first — <Link href="/gl-accounts/new" className="font-medium underline">create a GL account</Link>.</Alert>
        ) : (
          <JournalEntryForm
            glAccounts={(glAccounts ?? []) as any}
            associations={(associations ?? []) as any}
            action={createJournalEntry}
          />
        )}
      </div>
    </DataWorkspace>
  );
}
