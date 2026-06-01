import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { approveBill, voidBill } from '@/lib/rpcs/bills';
import { money, date } from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const { data: b } = await (supabase as any)
    .from('payable_bills')
    .select('*, vendors(name, address_street, address_city, address_state, address_zip, payment_type), associations(name), gl_accounts(number, name), bank_accounts(name, bank_name)')
    .eq('id', id)
    .maybeSingle();

  if (!b) notFound();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-gray-200 bg-white px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Link href="/bills" className="hover:text-brand-600">Accounts payable</Link>
              {' · '}
              <span className="text-gray-400">{b.vendors?.name}</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">Bill {b.bill_number ?? b.id.slice(0, 8)}</h1>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto bg-gray-50 px-8 py-6">

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Details</CardTitle>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${
              b.status === 'paid'             ? 'bg-green-100 text-green-700'
              : b.status === 'approved'       ? 'bg-blue-100 text-blue-700'
              : b.status === 'pending_approval' ? 'bg-amber-100 text-amber-800'
              : b.status === 'void'           ? 'bg-gray-100 text-gray-500 line-through'
              : 'bg-gray-100 text-gray-700'
            }`}>{b.status}</span>
          </div>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-gray-500">Vendor</dt><dd className="font-medium">{b.vendors?.name}</dd></div>
            <div><dt className="text-gray-500">Pay by</dt><dd className="uppercase">{b.vendors?.payment_type}</dd></div>
            <div><dt className="text-gray-500">Association</dt><dd>{b.associations?.name ?? '— Portfolio-wide —'}</dd></div>
            <div><dt className="text-gray-500">Amount</dt><dd className="font-semibold">{money(b.amount)}</dd></div>
            <div><dt className="text-gray-500">Bill date</dt><dd>{date(b.bill_date)}</dd></div>
            <div><dt className="text-gray-500">Due date</dt><dd>{date(b.due_date)}</dd></div>
            <div><dt className="text-gray-500">GL account</dt><dd>{b.gl_accounts ? `${b.gl_accounts.number} — ${b.gl_accounts.name}` : '—'}</dd></div>
            <div><dt className="text-gray-500">Bank account</dt><dd>{b.bank_accounts?.name ?? '—'}</dd></div>
            <div className="col-span-2">
              <dt className="text-gray-500">Memo (prints on check)</dt>
              <dd className="mt-1 rounded bg-gray-50 p-2 font-mono text-xs">{b.memo ?? '—'}</dd>
            </div>
            <div><dt className="text-gray-500">Approved</dt><dd>{b.approved_at ? date(b.approved_at) : '—'}</dd></div>
            <div><dt className="text-gray-500">Paid</dt><dd>{b.paid_at ? date(b.paid_at) : '—'}</dd></div>
          </dl>
        </CardBody>
      </Card>

      <div className="flex gap-2">
        {b.status === 'pending_approval' && (
          <form action={async () => { 'use server'; await approveBill(id); }}>
            <Button type="submit">Approve</Button>
          </form>
        )}
        {['draft','pending_approval','approved'].includes(b.status) && b.paid_at === null && (
          <form action={async () => { 'use server'; await voidBill(id); }}>
            <Button type="submit" variant="destructive">Void</Button>
          </form>
        )}
        {b.status === 'approved' && b.paid_at === null && (
          <Link href="/bills/check-run"><Button variant="secondary">Include in check run</Button></Link>
        )}
      </div>
      </div>
    </div>
  );
}
