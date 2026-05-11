import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';
import type { Database } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

type BillStatus = Database['public']['Enums']['payable_bill_status'];
type BillStatusFilter = BillStatus | 'all';

const TABS: Array<{ key: BillStatusFilter; label: string }> = [
  { key: 'pending_approval', label: 'Pending approval' },
  { key: 'approved',         label: 'Approved' },
  { key: 'draft',            label: 'Drafts' },
  { key: 'paid',             label: 'Paid' },
  { key: 'all',              label: 'All' },
];

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: statusParam } = await searchParams;
  const status = parseBillStatusFilter(statusParam);
  const supabase = await createClient();
  const { data: allCounts } = await (supabase as any).from('payable_bills').select('status').is('archived_at', null);

  let q = (supabase as any).from('payable_bills')
    .select('id, bill_number, due_date, amount, memo, status, paid_at, vendors(name, payment_type), associations(name)')
    .is('archived_at', null)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (status !== 'all') q = q.eq('status', status);
  const { data: rows } = await q.limit(300);

  const count = (s: BillStatusFilter) => s === 'all' ? (allCounts ?? []).length : (allCounts ?? []).filter((r: any) => r.status === s).length;
  const total = (rows ?? []).reduce((a: number, r: any) => a + Number(r.amount ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-8 py-6 space-y-4">
      <nav className="text-xs font-semibold uppercase tracking-wider text-ink-500">Payables</nav>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Payables</h1>
        <div className="flex gap-2">
          <Link href="/bills/check-run"><Button variant="secondary">Run checks</Button></Link>
          <Link href="/bills/new"><Button>+ New bill</Button></Link>
        </div>
      </div>
      <p className="text-sm text-ink-500">{rows?.length ?? 0} bills - {money(total)}</p>

      <nav className="flex flex-wrap gap-1 border-b border-ink-100">
        {TABS.map((t) => {
          const active = t.key === status;
          return (
            <Link key={t.key} href={`/bills?status=${t.key}`}
              className={`border-b-2 px-4 py-2 text-sm transition ${active ? 'border-brand-600 font-medium text-brand-600' : 'border-transparent text-ink-600 hover:text-ink-900'}`}>
              {t.label} <span className={`ml-1 rounded px-1.5 text-xs tabular-nums ${active ? 'bg-brand-100 text-brand-700' : 'bg-cream-100 text-ink-500'}`}>{count(t.key)}</span>
            </Link>
          );
        })}
      </nav>

      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Vendor</TH><TH>Association</TH><TH>Memo</TH><TH className="text-right">Amount</TH><TH>Due</TH><TH>Status</TH></TR></THead>
          <tbody>
            {rows.map((b: any) => (
              <TR key={b.id}>
                <TD className="font-medium"><Link href={`/bills/${b.id}`} className="text-champagne-700 hover:underline">{b.vendors?.name}</Link><span className="ml-1 text-xs text-ink-400">- {b.vendors?.payment_type}</span></TD>
                <TD className="text-sm text-ink-700">{b.associations?.name ?? '-'}</TD>
                <TD className="max-w-sm truncate text-sm text-ink-600" title={b.memo ?? ''}>{b.memo ?? '-'}</TD>
                <TD className="text-right tabular-nums font-medium">{money(b.amount)}</TD>
                <TD className="whitespace-nowrap text-sm">{date(b.due_date)}</TD>
                <TD><span className={`rounded px-2 py-0.5 text-xs ${
                  b.status === 'paid' ? 'bg-green-100 text-green-700' :
                  b.status === 'approved' ? 'bg-blue-100 text-champagne-700' :
                  b.status === 'pending_approval' ? 'bg-amber-100 text-amber-800' :
                  b.status === 'void' ? 'bg-cream-100 text-ink-500' : 'bg-cream-100 text-ink-700'
                }`}>{b.status}</span></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : <p className="rounded border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No bills in this view.</p>}
    </div>
  );
}

function parseBillStatusFilter(value: string | undefined): BillStatusFilter {
  switch (value) {
    case 'pending_approval':
    case 'approved':
    case 'draft':
    case 'paid':
    case 'void':
    case 'all':
      return value;
    default:
      return 'approved';
  }
}
