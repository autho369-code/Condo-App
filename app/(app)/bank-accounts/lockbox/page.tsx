import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { CsvUploadForm } from '@/components/imports/csv-upload-form';
import { Field, Input, Select } from '@/components/ui/input';
import { Badge, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { importLockbox } from '@/lib/rpcs/lockbox';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TEMPLATE = ['check_number,amount,payer,unit,memo', '1001,350.00,Jane Smith,101,October dues', '1002,420.00,"Lee, Kim",,'].join('\n');

const STATUS: Record<string, { label: string; tone: 'pending' | 'progress' | 'complete' | 'danger' | 'inactive' }> = {
  received: { label: 'Needs review', tone: 'pending' },
  processing: { label: 'Partly posted', tone: 'progress' },
  deposited: { label: 'Posted', tone: 'complete' },
  reconciled: { label: 'Reconciled', tone: 'complete' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export default async function LockboxPage() {
  await requireFinanceStaff();
  const db = (await createClient()) as any;
  const [{ data: banks }, { data: batches, error }] = await Promise.all([
    db.from('bank_accounts').select('id, name, association_id, associations!bank_accounts_association_id_fkey(name)').is('archived_at', null).not('association_id', 'is', null).order('name'),
    db.from('lockbox_batches').select('id, batch_date, deposit_reference, status, total_items, total_amount_cents, bank_accounts!inner(name)')
      .order('batch_date', { ascending: false }).order('created_at', { ascending: false }).limit(100),
  ]);
  if (error) throw new Error(`Could not load lockbox batches: ${error.message}`);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <DataWorkspace
      title="Lockbox"
      description="Import the bank's lockbox file, let Portier369 match each check to a unit, review, and post them as receipts."
    >
      <div className="space-y-6">
        <Surface>
          <SectionTitle title="Import a lockbox file" description="Columns: check_number, amount, payer, unit (the coupon or remittance unit number), memo. Matching tries the unit number, then the owner's name, then an exact open balance." />
          <CsvUploadForm
            action={importLockbox}
            templateCsv={TEMPLATE}
            templateName="lockbox-template.csv"
            submitLabel="Import and match"
            extraFields={
              <>
                <Field label="Deposited to" htmlFor="bank_account_id" required>
                  <Select id="bank_account_id" name="bank_account_id" required defaultValue="">
                    <option value="">Choose the bank account</option>
                    {(banks ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}{b.associations?.name ? ` · ${b.associations.name}` : ''}</option>)}
                  </Select>
                </Field>
                <Field label="Deposit date" htmlFor="batch_date" required>
                  <Input id="batch_date" name="batch_date" type="date" required defaultValue={today} />
                </Field>
                <Field label="Batch / deposit reference" htmlFor="reference" hint="From the bank file — stops the same batch being imported twice.">
                  <Input id="reference" name="reference" maxLength={80} />
                </Field>
              </>
            }
          />
        </Surface>

        <Surface padded={false}>
          <div className="px-5 pt-5 sm:px-6"><SectionTitle title="Batches" /></div>
          {(batches ?? []).length === 0 ? (
            <p className="px-5 pb-6 text-sm text-gray-500 sm:px-6">No lockbox batches yet.</p>
          ) : (
            <Table>
              <THead>
                <tr><TH>Date</TH><TH>Reference</TH><TH>Bank account</TH><TH className="text-right">Checks</TH><TH className="text-right">Total</TH><TH>Status</TH></tr>
              </THead>
              <tbody>
                {(batches as any[]).map((b) => {
                  const st = STATUS[b.status] ?? { label: b.status, tone: 'inactive' as const };
                  return (
                    <TR key={b.id}>
                      <TD><Link href={`/bank-accounts/lockbox/${b.id}`} className="font-medium text-gray-950 hover:underline">{date(b.batch_date)}</Link></TD>
                      <TD className="text-sm text-gray-600">{b.deposit_reference ?? '—'}</TD>
                      <TD className="text-sm text-gray-600">{b.bank_accounts?.name}</TD>
                      <TD className="text-right tabular-nums">{b.total_items ?? 0}</TD>
                      <TD className="text-right tabular-nums">{money((b.total_amount_cents ?? 0) / 100)}</TD>
                      <TD><Badge tone={st.tone}>{st.label}</Badge></TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Surface>
      </div>
    </DataWorkspace>
  );
}
