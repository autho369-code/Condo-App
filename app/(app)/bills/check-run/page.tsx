import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { PageShell, PageHeader, Breadcrumb, Surface, SectionTitle } from '@/components/ui/shell';
import { Input, Field, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { writeChecks } from '@/lib/rpcs/bills';
import { money, date } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CheckRunPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
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
    <PageShell>
      <Breadcrumb items={[{ label: 'Payables', href: '/bills' }, { label: 'Check run' }]} />
      <PageHeader
        title="Check run"
        description="Select approved bills to pay in this check run."
        actions={<Link href="/bills"><Button variant="secondary">Cancel</Button></Link>}
      />

      {sp.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Could not write checks:</span> {sp.error}
        </div>
      )}

      <form action={writeChecks as any} className="space-y-6">
        <Surface>
          <SectionTitle title="Run settings" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Bank account" htmlFor="bank_account_id">
              <Select id="bank_account_id" name="bank_account_id" required>
                {(banks ?? []).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name} {b.bank_name ? `— ${b.bank_name}` : ''} (next: {b.next_check_number ?? '—'})</option>
                ))}
              </Select>
            </Field>
            <Field label="Starting check #" htmlFor="starting_check_number">
              <Input id="starting_check_number" name="starting_check_number" type="number" min={1}
                defaultValue={defaultBank?.next_check_number ?? ''} required />
            </Field>
            <Field label="Payment date" htmlFor="payment_date">
              <Input id="payment_date" name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
          </div>
        </Surface>

        <div>
          <SectionTitle
            title="Approved bills to pay"
            actions={
              <div className="text-sm text-gray-600">
                {queue?.length ?? 0} bills · <span className="font-semibold tabular-nums">{money(total)}</span>
              </div>
            }
          />
          {queue?.length ? (
            <Table>
              <THead><tr>
                <TH className="w-8"><SelectAllCheckbox targetName="bill_ids" /></TH>
                <TH>Vendor</TH><TH>Association</TH><TH>Memo</TH>
                <TH className="text-right">Amount</TH><TH>Due</TH>
              </tr></THead>
              <tbody>
                {(queue ?? []).map((b: any) => (
                  <TR key={b.bill_id}>
                    <TD><input type="checkbox" name="bill_ids" value={b.bill_id} defaultChecked /></TD>
                    <TD className="font-medium">{b.vendor_name}</TD>
                    <TD>{b.association_name ?? '—'}</TD>
                    <TD className="max-w-sm truncate text-gray-600" title={b.memo ?? ''}>{b.memo ?? '—'}</TD>
                    <TD className="text-right tabular-nums">{money(b.amount)}</TD>
                    <TD>{date(b.due_date)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-gray-200/70 bg-white p-6 text-center text-sm text-gray-500 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              No approved, unpaid bills for vendors that pay by check.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Link href="/bills"><Button variant="secondary" type="button">Cancel</Button></Link>
          <Button type="submit">Write checks</Button>
        </div>
      </form>
    </PageShell>
  );
}
