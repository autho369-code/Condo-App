import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BankTransfersPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('bank_transfers')
    .select(`id, amount, transfer_date, reference_number, memo,
             from:from_bank_account_id(name), to:to_bank_account_id(name)`)
    .order('transfer_date', { ascending: false })
    .limit(100);

  return (
    <ModulePage title="Bank Transfers" description="Inter-account transfers — reserve transfers, operating deposits, etc.">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Date</TH><TH>From</TH><TH>To</TH><TH className="text-right">Amount</TH><TH>Ref #</TH><TH>Memo</TH></TR></THead>
          <tbody>
            {rows.map((t: any) => (
              <TR key={t.id}>
                <TD className="whitespace-nowrap text-sm">{date(t.transfer_date)}</TD>
                <TD>{t.from?.name}</TD>
                <TD>{t.to?.name}</TD>
                <TD className="text-right tabular-nums font-medium">{money(t.amount)}</TD>
                <TD className="font-mono text-xs text-slate-400">{t.reference_number ?? '—'}</TD>
                <TD className="max-w-xs truncate text-sm text-slate-400">{t.memo ?? '—'}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-slate-400">No transfers yet.</p>
      )}
    </ModulePage>
  );
}
