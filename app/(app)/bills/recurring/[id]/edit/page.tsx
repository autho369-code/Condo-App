import { notFound } from 'next/navigation';
import { Alert, Breadcrumb, PageHeader, PageShell } from '@/components/ui/shell';
import { RecurringBillForm, loadRecurringBillOptions } from '@/components/bills/recurring-bill-form';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function EditRecurringBillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const [{ data: bill }, options, { data: generated }] = await Promise.all([
    db.from('recurring_bills')
      .select('id, name, vendor_id, association_id, gl_account_id, bank_account_id, memo, amount, frequency, interval_count, start_date, end_date, due_days, auto_generate, next_post_date')
      .eq('id', id).is('archived_at', null).maybeSingle(),
    loadRecurringBillOptions(db),
    db.from('payable_bills').select('id, bill_date, amount, status').eq('recurring_bill_id', id).order('bill_date', { ascending: false }).limit(12),
  ]);
  if (!bill) notFound();

  return (
    <PageShell className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Payables', href: '/bills' }, { label: 'Recurring bills', href: '/bills/recurring' }, { label: bill.name }]} />
      <PageHeader
        title={bill.name}
        description={bill.auto_generate && bill.next_post_date ? `Next bill ${date(bill.next_post_date)}` : 'Paused'}
      />
      {sp.error && <div className="mb-6"><Alert tone="danger" title="Could not save">{sp.error}</Alert></div>}
      <RecurringBillForm values={bill} {...options} />
      {(generated ?? []).length > 0 && (
        <div className="mt-6 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Bills created</h2>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {(generated as any[]).map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <a href={`/bills/${b.id}`} className="text-gray-900 hover:underline">{date(b.bill_date)}</a>
                <span className="text-gray-500">{b.status.replace(/_/g, ' ')} · {money(b.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  );
}
