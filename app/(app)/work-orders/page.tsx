import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'open',       label: 'Open',        filter: (r: any) => !['completed','closed','cancelled'].includes(r.status) },
  { key: 'emergency',  label: 'Emergencies', filter: (r: any) => r.priority === 'emergency' && !['completed','closed','cancelled'].includes(r.status) },
  { key: 'scheduled',  label: 'Scheduled',   filter: (r: any) => r.status === 'scheduled' },
  { key: 'unassigned', label: 'Unassigned',  filter: (r: any) => !r.vendor_id && !['completed','closed','cancelled'].includes(r.status) },
  { key: 'completed',  label: 'Completed',   filter: (r: any) => r.status === 'completed' || r.status === 'closed' },
  { key: 'all',        label: 'All',         filter: () => true },
];

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'open' } = await searchParams;
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('work_orders')
    .select('id, number, title, status, priority, scheduled_date, vendor_id, vendors(name), units(unit_number), associations(name)')
    .is('archived_at', null)
    .order('priority', { ascending: false })
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(500);
  const all = (rows ?? []) as any[];
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const filtered = all.filter(active.filter);

  return (
    <div className="mx-auto max-w-5xl px-8 py-6 space-y-4">
      <nav className="text-xs font-semibold uppercase tracking-wider text-slate-400">Work Orders</nav>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Work Orders</h1>
        <Link href="/work-orders/new"><Button>+ New work order</Button></Link>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const count = all.filter(t.filter).length;
          const isActive = t.key === tab;
          return (
            <Link key={t.key} href={`/work-orders?tab=${t.key}`}
              className={`border-b-2 px-4 py-2 text-sm transition ${isActive ? 'border-brand-600 font-medium text-brand-600' : 'border-transparent text-slate-400 hover:text-gray-900'}`}>
              {t.label} <span className={`ml-1 rounded px-1.5 text-xs tabular-nums ${isActive ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-slate-400'}`}>{count}</span>
            </Link>
          );
        })}
      </nav>

      {filtered.length > 0 ? (
        <Table>
          <THead><TR><TH>#</TH><TH>Title</TH><TH>Where</TH><TH>Vendor</TH><TH>Priority</TH><TH>Status</TH><TH>Scheduled</TH></TR></THead>
          <tbody>
            {filtered.map((w: any) => (
              <TR key={w.id}>
                <TD className="font-mono text-xs"><Link href={`/work-orders/${w.id}`} className="text-blue-700 hover:underline">{w.number ?? w.id.slice(0, 8)}</Link></TD>
                <TD className="max-w-sm"><Link href={`/work-orders/${w.id}`} className="font-medium text-gray-900 hover:underline">{w.title}</Link></TD>
                <TD className="text-sm text-gray-700">{w.associations?.name}{w.units?.unit_number ? ` · Unit ${w.units.unit_number}` : ''}</TD>
                <TD className="text-sm text-gray-700">{w.vendors?.name ?? <span className="text-red-600">Unassigned</span>}</TD>
                <TD><Priority p={w.priority} /></TD>
                <TD className="text-sm capitalize text-slate-400">{w.status?.replace(/_/g, ' ')}</TD>
                <TD className="whitespace-nowrap text-sm text-slate-400">{date(w.scheduled_date)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-slate-400">No work orders in this view.</p>}
    </div>
  );
}

function Priority({ p }: { p?: string | null }) {
  const m: Record<string, string> = { emergency: 'bg-red-100 text-red-800', high: 'bg-orange-100 text-orange-800', normal: 'bg-gray-100 text-gray-700', low: 'bg-gray-100 text-slate-400' };
  if (!p) return null;
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${m[p] ?? m.normal}`}>{p}</span>;
}
