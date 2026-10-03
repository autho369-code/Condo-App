import Link from 'next/link';
import { Landmark, Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { StatusChip } from '@/components/operations/status-chip';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { voidBankDeposit } from '@/lib/rpcs/bank-deposits';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BankDepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; voided?: string; error?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { rows: deposits, error } = await fetchAllRows<any>(() => db.from('bank_deposits')
    .select('id, deposit_date, amount, receipt_count, memo, voided_at, bank_accounts(name), associations(name)')
    .order('deposit_date', { ascending: false })
    .order('id'));
  if (error) throw new Error(`Could not load bank deposits: ${error}`);

  return (
    <DataWorkspace
      title="Bank deposits"
      description="Receipts grouped into the deposits taken to the bank. Each deposit matches one line on the bank statement."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/bank-accounts/deposits/other"><Button variant="secondary">Other deposit</Button></Link>
          <Link href="/bank-accounts/deposits/new"><Button><Plus className="h-4 w-4" /> New bank deposit</Button></Link>
        </div>
      }
    >
      <div className="space-y-4">
        {sp.created && <Alert tone="success" title="Deposit saved" />}
        {sp.voided && <Alert tone="success" title="Deposit undone">Its receipts are undeposited again.</Alert>}
        {sp.error && <Alert tone="danger" title="Could not update the deposit">{sp.error}</Alert>}
        {deposits.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={Landmark}
              title="No bank deposits yet"
              description="Group the receipts you take to the bank into a deposit."
              action={<Link href="/bank-accounts/deposits/new"><Button><Plus className="h-4 w-4" /> New bank deposit</Button></Link>}
            />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Bank account</TH>
                <TH>Association</TH>
                <TH>Receipts</TH>
                <TH>Memo</TH>
                <TH className="text-right">Amount</TH>
                <TH>Status</TH>
                <TH><span className="sr-only">Actions</span></TH>
              </tr>
            </THead>
            <tbody>
              {deposits.map((d: any) => (
                <TR key={d.id}>
                  <TD className="whitespace-nowrap">{date(d.deposit_date)}</TD>
                  <TD>{d.bank_accounts?.name ?? '—'}</TD>
                  <TD>{d.associations?.name ?? '—'}</TD>
                  <TD className="tabular-nums">{d.receipt_count}</TD>
                  <TD className="max-w-xs truncate text-gray-600">{d.memo ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{money(d.amount)}</TD>
                  <TD>{d.voided_at ? <StatusChip tone="neutral">Undone</StatusChip> : <StatusChip tone="success">Deposited</StatusChip>}</TD>
                  <TD className="text-right">
                    {!d.voided_at && (
                      <form action={voidBankDeposit}>
                        <input type="hidden" name="id" value={d.id} />
                        <Button type="submit" variant="ghost" size="sm">Undo</Button>
                      </form>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
