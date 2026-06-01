import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { writeChecks } from '@/lib/rpcs/bills';
import { money, date } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CheckRunPage() {
  await requireStaff();
  const supabase = await createClient();

  const [{ data: queue }, { data: banks }] = await Promise.all([
    (supabase as any).from('v_check_writing_queue').select('*'),
    (supabase as any).from('bank_accounts')
      .select('id, name, bank_name, next_check_number')
      .is('archived_at', null)
      .order('name'),
  ]);

  const total = (queue ?? []).reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0);
  const defaultBank = (banks ?? [])[0];

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-gray-200 bg-white px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Link href="/bills" className="hover:text-brand-600">Accounts payable</Link>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">Check run</h1>
            <p className="mt-1 text-sm text-slate-400">Select approved bills to pay in this check run.</p>
          </div>
          <Link href="/bills"><Button variant="secondary" size="sm">Cancel</Button></Link>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50 px-8 py-6">

      <form action={writeChecks as any} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Run settings</CardTitle></CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="bank_account_id">Bank account</Label>
                <select id="bank_account_id" name="bank_account_id" required
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  {(banks ?? []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name} {b.bank_name ? `— ${b.bank_name}` : ''} (next: {b.next_check_number ?? '—'})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="starting_check_number">Starting check #</Label>
                <Input id="starting_check_number" name="starting_check_number" type="number" min={1}
                  defaultValue={defaultBank?.next_check_number ?? ''} required />
              </div>
              <div>
                <Label htmlFor="payment_date">Payment date</Label>
                <Input id="payment_date" name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Approved bills to pay</CardTitle>
              <div className="text-sm text-slate-400">
                {queue?.length ?? 0} bills · <span className="font-semibold">{money(total)}</span>
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <Table>
              <THead><TR>
                <TH className="w-8"><SelectAllCheckbox targetName="bill_ids" /></TH>
                <TH>Vendor</TH><TH>Association</TH><TH>Memo</TH>
                <TH className="text-right">Amount</TH><TH>Due</TH>
              </TR></THead>
              <tbody>
                {(queue ?? []).map((b: any) => (
                  <TR key={b.bill_id}>
                    <TD><input type="checkbox" name="bill_ids" value={b.bill_id} defaultChecked /></TD>
                    <TD className="font-medium">{b.vendor_name}</TD>
                    <TD>{b.association_name ?? '—'}</TD>
                    <TD className="max-w-sm truncate text-slate-400" title={b.memo ?? ''}>{b.memo ?? '—'}</TD>
                    <TD className="text-right">{money(b.amount)}</TD>
                    <TD>{date(b.due_date)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            {!queue?.length && (
              <div className="p-6 text-center text-sm text-slate-400">
                No approved, unpaid bills for vendors that pay by check.
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Link href="/bills"><Button variant="secondary" type="button">Cancel</Button></Link>
          <Button type="submit">Write checks</Button>
        </div>
      </form>
      </div>
    </div>
  );
}
