import Link from 'next/link';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LockboxPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: batches } = await (supabase as any)
    .from('lockbox_batches')
    .select('id, provider, provider_batch_id, batch_date, received_at, status, total_amount_cents, total_items, deposit_reference, bank_accounts(name, bank_name), lockbox_items(id, payer_name, check_number, check_amount_cents, payment_id, rejected)')
    .order('received_at', { ascending: false })
    .limit(100);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Lockbox</h1>
          <Link href="/lockbox/new" className="border border-ink-900 bg-white px-3 py-1.5 text-xs text-ink-900">New Lockbox Batch</Link>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Received</TH>
              <TH>Provider</TH>
              <TH>Bank Account</TH>
              <TH>Items</TH>
              <TH className="text-right">Amount</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {(batches ?? []).map((batch: any) => (
              <TR key={batch.id}>
                <TD>{date(batch.received_at ?? batch.batch_date)}</TD>
                <TD>
                  <div className="font-medium text-ink-900">{batch.provider}</div>
                  <div className="text-xs text-ink-500">{batch.provider_batch_id ?? batch.deposit_reference ?? '-'}</div>
                </TD>
                <TD>{batch.bank_accounts?.name ?? 'Not assigned'}</TD>
                <TD>
                  <div>{batch.total_items ?? batch.lockbox_items?.length ?? 0}</div>
                  <div className="text-xs text-ink-500">
                    {(batch.lockbox_items ?? []).filter((item: any) => item.payment_id).length} matched
                  </div>
                </TD>
                <TD className="text-right font-medium">{money(Number(batch.total_amount_cents ?? 0) / 100)}</TD>
                <TD><span className="bg-ink-100 px-2 py-0.5 text-[10px] font-medium uppercase text-ink-700">{batch.status}</span></TD>
              </TR>
            ))}
            {(batches ?? []).length === 0 && (
              <TR><TD colSpan={6} className="text-center text-sm text-ink-500">No lockbox batches found.</TD></TR>
            )}
          </tbody>
        </Table>
      </main>
    </div>
  );
}
