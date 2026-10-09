import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { VendorSelect } from '@/components/vendors/vendor-select';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { newSubmissionToken, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { requireFinanceStaff } from '@/lib/auth/me';
import { recordOtherReceipt } from '@/lib/rpcs/other-receipts';
import { createClient } from '@/lib/supabase/server';
import { todayInZone } from '@/lib/time/zoned';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export const dynamic = 'force-dynamic';

const LINE_ROWS = 5;

export default async function NewOtherReceiptPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const portfolioId = me.portfolio?.id;

  const [{ data: associations }, { data: banks }, { data: vendors }, { data: glAccounts }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('bank_accounts').select('id, name, association_id, gl_account_id, associations!bank_accounts_association_id_fkey(name)').is('archived_at', null).order('name'),
    fetchAllRows<any>(() => db.from('vendors').select('id, name, association_id, is_management_company').eq('portfolio_id', portfolioId).is('archived_at', null).order('name').order('id')).then((r) => ({ data: r.rows, error: r.error ? { message: r.error } : null })),
    db.from('gl_accounts').select('id, number, name, account_type, association_id, associations!gl_accounts_association_id_fkey(name)').eq('portfolio_id', portfolioId).eq('active', true)
      .not('account_type', 'in', '(cash,accounts_receivable)').order('number'),
  ]);
  const today = todayInZone();
  const usableBanks = (banks ?? []).filter((b: any) => b.gl_account_id);

  return (
    <DataWorkspace
      title="Record other receipt"
      description="Money the association receives that isn't a homeowner payment — vendor refunds, insurance proceeds, laundry or cell-tower income, reimbursements. Split it across as many GL accounts as needed; it posts to the ledger straight away."
      actions={<Link href="/receipts/other"><Button variant="secondary">Back to other receipts</Button></Link>}
    >
      <div className="max-w-4xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not record receipt">{sp.error}</Alert>}
        {usableBanks.length === 0 ? (
          <Alert tone="warning" title="No bank account is linked to a GL account">
            Link a GL account on the bank account first — <Link href="/bank-accounts" className="font-medium underline">bank accounts</Link>.
          </Alert>
        ) : (
          <form action={recordOtherReceipt} className="space-y-5">
            <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
            <Surface>
              <SectionTitle title="Receipt" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Association" htmlFor="association_id">
                  <Select id="association_id" name="association_id" required defaultValue="">
                    <option value="">Select association</option>
                    {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                </Field>
                <Field label="Deposit to">
                  <Select name="bank_account_id" required defaultValue="">
                    <option value="">Select bank account</option>
                    {usableBanks.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.associations?.name ? `${b.associations.name} — ${b.name}` : b.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Received from">
                  <Select name="payer_type" defaultValue="other">
                    <option value="other">Other payer</option>
                    <option value="vendor">Vendor</option>
                  </Select>
                </Field>
                <Field label="Vendor (for vendor receipts)" htmlFor="vendor_id">
                  <VendorSelect id="vendor_id" name="vendor_id" defaultValue="" vendors={vendors ?? []} placeholder="—" />
                </Field>
                <Field label="Payer name" hint="Required for other payers; defaults to the vendor's name.">
                  <Input name="payer_name" maxLength={200} placeholder="e.g. State Farm, Coinmach Laundry" />
                </Field>
                <Field label="Receipt date">
                  <Input name="receipt_date" type="date" defaultValue={today} required />
                </Field>
                <Field label="Check / reference number (optional)">
                  <Input name="reference" maxLength={100} />
                </Field>
              </div>
              <Field label="Memo (optional)" className="mt-4">
                <Textarea name="memo" rows={2} maxLength={1000} />
              </Field>
            </Surface>

            <Surface>
              <SectionTitle title="Split" description="Credit each GL account with its share. Blank rows are ignored." />
              <div className="space-y-3">
                {Array.from({ length: LINE_ROWS }, (_, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr]">
                    <Field label={i === 0 ? 'GL account' : undefined}>
                      <Select name={`line_gl_${i}`} defaultValue="" aria-label={`Line ${i + 1} GL account`} required={i === 0}>
                        <option value="">Select GL account</option>
                        {(glAccounts ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.number} — {g.name}{g.association_id ? ` (${g.associations?.name ?? 'one association'} only)` : ''}</option>)}
                      </Select>
                    </Field>
                    <Field label={i === 0 ? 'Amount' : undefined}>
                      <Input name={`line_amount_${i}`} type="number" step="0.01" min="0.01" placeholder="$0.00" aria-label={`Line ${i + 1} amount`} required={i === 0} />
                    </Field>
                    <Field label={i === 0 ? 'Line memo (optional)' : undefined}>
                      <Input name={`line_memo_${i}`} maxLength={300} aria-label={`Line ${i + 1} memo`} />
                    </Field>
                  </div>
                ))}
              </div>
            </Surface>

            <PendingSubmit pendingLabel="Recording…">Record receipt</PendingSubmit>
          </form>
        )}
      </div>
    </DataWorkspace>
  );
}
