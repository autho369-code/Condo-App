import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Breadcrumb, PageHeader, PageShell } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import NewBillForm from './new-bill-form';

export const dynamic = 'force-dynamic';

export default async function NewBillPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();

  // All the dropdown sources are filtered by RLS to the user's portfolio
  const [{ data: vendors }, { data: associations }, { data: gls }, { data: banks }] = await Promise.all([
    (supabase as any).from('vendors')
      .select('id, name, trade, payment_type')
      .is('archived_at', null)
      .order('name'),
    (supabase as any).from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
    (supabase as any).from('gl_accounts')
      .select('id, number, name, account_type')
      .eq('active', true)
      .in('account_type', ['expense','cost_of_goods_sold','other_expense'])
      .order('number'),
    (supabase as any).from('bank_accounts')
      .select('id, name, bank_name')
      .is('archived_at', null)
      .order('name'),
  ]);

  return (
    <PageShell className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Accounts payable', href: '/bills' }, { label: 'New bill' }]} />
      <PageHeader
        title="New bill"
        actions={<Link href="/bills"><Button variant="secondary">Cancel</Button></Link>}
      />

      {sp.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Could not save bill:</span> {sp.error}
        </div>
      )}

      <NewBillForm
        vendors={vendors ?? []}
        associations={associations ?? []}
        gls={gls ?? []}
        banks={banks ?? []}
        portfolioId={me.portfolio?.id ?? ''}
      />
    </PageShell>
  );
}
