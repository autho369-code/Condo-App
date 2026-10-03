import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Alert } from '@/components/ui/shell';
import { Field, Input } from '@/components/ui/input';
import { StatusChip } from '@/components/operations/status-chip';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { voidBankTransfer } from '@/lib/rpcs/bank-transfers';
import { todayInZone } from '@/lib/time/zoned';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BankTransferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; recorded?: string; voided?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { data: t } = await db
    .from('bank_transfers')
    .select(`id, amount, transfer_date, reference_number, memo, journal_entry_id, voided_at, void_reason, void_entry_id, authorization_note, created_at,
      from:from_bank_account_id(id, name, fund_type, associations!bank_accounts_association_id_fkey(name)),
      to:to_bank_account_id(id, name, fund_type, associations!bank_accounts_association_id_fkey(name))`)
    .eq('id', id)
    .maybeSingle();
  if (!t) notFound();

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<Link href="/bank-transfers" className="transition-colors hover:text-gray-700">Bank transfers</Link>}
          title={`${t.from?.name ?? 'Account'} → ${t.to?.name ?? 'Account'}`}
        />
      }
    >
      {sp.error && <Alert tone="danger" title="Could not void the transfer">{sp.error}</Alert>}
      {sp.recorded && <Alert tone="success" title="Transfer recorded and posted to the ledger" />}
      {sp.voided && <Alert tone="success" title="Transfer voided">Its posting was reversed.</Alert>}

      <Section
        title="Details"
        actions={t.voided_at ? <StatusChip tone="neutral">Void</StatusChip> : t.journal_entry_id ? <StatusChip tone="success">Completed</StatusChip> : <StatusChip tone="warning">Incomplete</StatusChip>}
        padded
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">From</dt><dd className="text-gray-900"><Link href={`/bank-accounts/${t.from?.id}`} className="font-medium hover:underline">{t.from?.name}</Link>{t.from?.fund_type ? ` · ${t.from.fund_type}` : ''}</dd></div>
          <div><dt className="text-gray-500">To</dt><dd className="text-gray-900"><Link href={`/bank-accounts/${t.to?.id}`} className="font-medium hover:underline">{t.to?.name}</Link>{t.to?.fund_type ? ` · ${t.to.fund_type}` : ''}</dd></div>
          <div><dt className="text-gray-500">Association</dt><dd className="text-gray-900">{t.from?.associations?.name ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Amount</dt><dd className="font-semibold tabular-nums text-gray-950">{money(t.amount)}</dd></div>
          <div><dt className="text-gray-500">Transfer date</dt><dd className="text-gray-900">{date(t.transfer_date)}</dd></div>
          <div><dt className="text-gray-500">Reference</dt><dd className="font-mono text-gray-900">{t.reference_number ?? '—'}</dd></div>
          {t.memo && <div className="sm:col-span-2"><dt className="text-gray-500">Memo</dt><dd className="text-gray-900">{t.memo}</dd></div>}
          {t.authorization_note && <div className="sm:col-span-2"><dt className="text-gray-500">Fund transfer authorization</dt><dd className="text-gray-900">{t.authorization_note}</dd></div>}
          {t.journal_entry_id && <div><dt className="text-gray-500">Ledger</dt><dd><Link href={`/journal-entries/${t.journal_entry_id}`} className="font-medium hover:underline">Journal entry</Link></dd></div>}
          {t.voided_at && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Voided</dt>
              <dd className="text-gray-900">
                {date(t.voided_at)} · {t.void_reason}
                {t.void_entry_id && <> · <Link href={`/journal-entries/${t.void_entry_id}`} className="font-medium hover:underline">Reversing entry</Link></>}
              </dd>
            </div>
          )}
        </dl>
      </Section>

      {!t.voided_at && (
        <Section title="Void transfer" padded>
          <p className="mb-3 text-sm text-gray-600">
            {t.journal_entry_id
              ? 'Reverses the posting on the date you choose. The transfer stays on record, marked void.'
              : 'This transfer was never posted; voiding takes it off the Incomplete list.'}
          </p>
          <form action={voidBankTransfer} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={t.id} />
            <Field label="Void date" htmlFor="void_date">
              <Input id="void_date" name="void_date" type="date" required defaultValue={todayInZone()} />
            </Field>
            <Field label="Reason" htmlFor="reason" className="min-w-64 flex-1">
              <Input id="reason" name="reason" required minLength={3} maxLength={200} placeholder="Entered the wrong amount" />
            </Field>
            <PendingSubmit variant="danger" pendingLabel="Voiding…">Void transfer</PendingSubmit>
          </form>
        </Section>
      )}
    </Workspace>
  );
}
