import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Badge } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { approveBill, voidBill, voidPaidCheck } from '@/lib/rpcs/bills';
import { money, date } from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BillDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: b } = await (supabase as any)
    .from('payable_bills')
    .select('*, vendors(name, address_street, address_city, address_state, address_zip, payment_type), associations(name), gl_accounts(number, name), bank_accounts(name, bank_name)')
    .eq('id', id)
    .maybeSingle();

  if (!b) notFound();
  const { data: checks } = await (supabase as any)
    .from('payable_checks')
    .select('id, check_number, amount, payment_date, status, issued_at, voided_at, void_reason, bank_accounts(name, bank_name)')
    .eq('bill_id', id)
    .order('issued_at', { ascending: false });
  const issuedCheck = (checks ?? []).find((check: any) => check.status === 'issued');

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/bills" className="transition-colors hover:text-gray-700">Accounts payable</Link>
              {' · '}
              {b.vendors?.name}
            </>
          }
          title={`Bill ${b.bill_number ?? b.id.slice(0, 8)}`}
        />
      }
    >
      {sp.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Could not update bill:</span> {sp.error}
        </div>
      )}

      <Section
        title="Details"
        actions={<Badge status={b.status} />}
        padded
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Vendor</dt><dd className="font-medium text-gray-900">{b.vendors?.name}</dd></div>
          <div><dt className="text-gray-500">Pay by</dt><dd className="uppercase text-gray-900">{b.vendors?.payment_type}</dd></div>
          <div><dt className="text-gray-500">Association</dt><dd className="text-gray-900">{b.associations?.name ?? '— Portfolio-wide —'}</dd></div>
          <div><dt className="text-gray-500">Amount</dt><dd className="font-semibold tabular-nums text-gray-950">{money(b.amount)}</dd></div>
          <div><dt className="text-gray-500">Bill date</dt><dd className="text-gray-900">{date(b.bill_date)}</dd></div>
          <div><dt className="text-gray-500">Due date</dt><dd className="text-gray-900">{date(b.due_date)}</dd></div>
          <div><dt className="text-gray-500">GL account</dt><dd className="text-gray-900">{b.gl_accounts ? `${b.gl_accounts.number} — ${b.gl_accounts.name}` : '—'}</dd></div>
          <div><dt className="text-gray-500">Bank account</dt><dd className="text-gray-900">{b.bank_accounts?.name ?? '—'}</dd></div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Memo (prints on check)</dt>
            <dd className="mt-1 rounded-lg bg-gray-50 p-2 font-mono text-xs text-gray-700">{b.memo ?? '—'}</dd>
          </div>
          <div><dt className="text-gray-500">Approved</dt><dd className="text-gray-900">{b.approved_at ? date(b.approved_at) : '—'}</dd></div>
          <div><dt className="text-gray-500">Paid</dt><dd className="text-gray-900">{b.paid_at ? date(b.paid_at) : '—'}</dd></div>
        </dl>
      </Section>

      {(checks ?? []).length > 0 && (
        <Section title="Check history" padded>
          <div className="space-y-3">
            {(checks ?? []).map((check: any) => (
              <div key={check.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">Check #{check.check_number} · {money(check.amount)}</div>
                  <Badge status={check.status} />
                </div>
                <div className="mt-1 text-gray-500">{check.bank_accounts?.name ?? 'Bank'} · {date(check.payment_date)}</div>
                {check.void_reason && <div className="mt-1 text-red-700">{check.void_reason}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="flex flex-wrap gap-2">
        {b.status === 'pending_approval' && (
          <form action={async () => { 'use server'; await approveBill(id); }}>
            <Button type="submit">Approve</Button>
          </form>
        )}
        {['draft', 'pending_approval', 'approved'].includes(b.status) && b.paid_at === null && (
          <form action={async () => { 'use server'; await voidBill(id); }}>
            <Button type="submit" variant="danger">Void</Button>
          </form>
        )}
        {b.status === 'approved' && b.paid_at === null && (
          <Link href="/bills/check-run"><Button variant="secondary">Include in check run</Button></Link>
        )}
        {b.status === 'paid' && issuedCheck && (
          <form action={voidPaidCheck as any} className="flex flex-wrap items-end gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <input type="hidden" name="check_id" value={issuedCheck.id} />
            <input type="hidden" name="bill_id" value={id} />
            <label className="text-sm text-red-900">
              Void/stop reason
              <input name="reason" required minLength={3} className="mt-1 block rounded-md border border-red-300 bg-white px-3 py-2 text-sm" />
            </label>
            <Button type="submit" name="stop_payment" value="false" variant="danger">Void check</Button>
            <Button type="submit" name="stop_payment" value="true" variant="danger">Stop payment</Button>
          </form>
        )}
      </div>
    </Workspace>
  );
}
