import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireFinanceStaff } from '@/lib/auth/me';
import { recordBankTransfer } from '@/lib/rpcs/bank-transfers';
import { newSubmissionToken, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { todayInZone } from '@/lib/time/zoned';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function NewBankTransferPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireFinanceStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: accounts } = await db
    .from('bank_accounts')
    .select('id, name, bank_name, fund_type, associations:association_id(name)')
    .eq('portfolio_id', me.portfolio?.id).is('archived_at', null).order('name');

  const acctLabel = (a: any) => `${a.name}${a.fund_type ? ` [${a.fund_type}]` : ''}${a.bank_name ? ` (${a.bank_name})` : ''}${a.associations?.name ? ` · ${a.associations.name}` : ''}`;

  return (
    <DataWorkspace
      title="New Bank Transfer"
      description="Move money between two bank accounts of the same association. The transfer posts to the ledger when you record it."
      actions={<Link href="/bank-transfers"><Button variant="secondary">Back to transfers</Button></Link>}
    >
      <form action={recordBankTransfer} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
        {sp.error && <Alert tone="danger" title="Could not record transfer">{sp.error}</Alert>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="from_bank_account_id">From account <span className="text-red-500">*</span></Label>
            <select id="from_bank_account_id" name="from_bank_account_id" required className={inputCls}>
              <option value="">Select source</option>
              {(accounts ?? []).map((a: any) => <option key={a.id} value={a.id}>{acctLabel(a)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="to_bank_account_id">To account <span className="text-red-500">*</span></Label>
            <select id="to_bank_account_id" name="to_bank_account_id" required className={inputCls}>
              <option value="">Select destination</option>
              {(accounts ?? []).map((a: any) => <option key={a.id} value={a.id}>{acctLabel(a)}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="amount">Amount <span className="text-red-500">*</span></Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" />
          </div>
          <div>
            <Label htmlFor="transfer_date">Transfer date</Label>
            <Input id="transfer_date" name="transfer_date" type="date" required defaultValue={todayInZone()} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="reference_number">Reference #</Label>
            <Input id="reference_number" name="reference_number" placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="memo">Memo</Label>
            <Input id="memo" name="memo" placeholder="Optional" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" name="authorize_cross_fund" className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <span>
              <span className="font-medium">Authorize a cross-fund transfer</span>
              <span className="block text-xs text-gray-500">Required only when moving money between operating and reserve funds. You are recorded as the authorizer.</span>
            </span>
          </label>
          <div className="mt-3">
            <Label htmlFor="authorization_note">Authorization note</Label>
            <Input id="authorization_note" name="authorization_note" maxLength={1000} placeholder="e.g. Board approved reserve contribution on 9/15" />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/bank-transfers" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <PendingSubmit pendingLabel="Recording…">Record transfer</PendingSubmit>
        </div>
      </form>
    </DataWorkspace>
  );
}
