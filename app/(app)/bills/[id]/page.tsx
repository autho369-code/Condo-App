import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Badge } from '@/components/ui/shell';
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
      </div>
    </Workspace>
  );
}
