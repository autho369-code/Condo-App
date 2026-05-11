import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function UnitsPage({ searchParams }: { searchParams: Promise<{ assoc?: string; filter?: string }> }) {
  const { assoc, filter } = await searchParams;
  const supabase = await createClient();

  let q = (supabase as any).from('v_unit_account_summary').select('*');
  if (assoc) q = q.eq('association_id', assoc);
  const { data: rows } = await q.order('association_name').order('unit_number');

  const all = (rows ?? []) as any[];
  const filtered = filter === 'balance' ? all.filter((u) => Number(u.outstanding_balance ?? 0) > 0)
                 : filter === 'credit'  ? all.filter((u) => Number(u.unapplied_credit ?? 0) > 0)
                 : all;
  const { data: assocs } = await (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name');
  const outstanding = filtered.reduce((s, u) => s + Number(u.outstanding_balance ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-8 py-6 space-y-4">
      <nav className="text-xs font-semibold uppercase tracking-wider text-ink-500">Units</nav>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Units</h1>
        <Link href="/units/new"><Button>+ New unit</Button></Link>
      </div>
      <p className="text-sm text-ink-500">{filtered.length} units · {money(outstanding)} outstanding.</p>

      <form action="/units" method="get" className="flex flex-wrap items-center gap-2 rounded border border-ink-100 bg-white px-4 py-3">
        <select name="assoc" defaultValue={assoc ?? ''} className="h-9 rounded border border-ink-200 bg-white px-3 text-sm">
          <option value="">All associations</option>
          {(assocs ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select name="filter" defaultValue={filter ?? ''} className="h-9 rounded border border-ink-200 bg-white px-3 text-sm">
          <option value="">All units</option>
          <option value="balance">With outstanding balance</option>
          <option value="credit">With credit on file</option>
        </select>
        <Button size="sm" variant="secondary" type="submit">Apply</Button>
      </form>

      {filtered.length > 0 ? (
        <Table>
          <THead><TR><TH>Association</TH><TH>Unit</TH><TH className="text-right">Charged</TH><TH className="text-right">Paid</TH><TH className="text-right">Balance</TH><TH className="text-right">Credit</TH></TR></THead>
          <tbody>
            {filtered.map((u: any) => (
              <TR key={u.unit_id}>
                <TD className="text-sm text-ink-700">{u.association_name}</TD>
                <TD className="font-medium"><Link href={`/units/${u.unit_id}`} className="text-champagne-700 hover:underline">Unit {u.unit_number}</Link></TD>
                <TD className="text-right tabular-nums">{money(u.total_charged)}</TD>
                <TD className="text-right tabular-nums">{money(u.total_paid)}</TD>
                <TD className={`text-right tabular-nums font-medium ${Number(u.outstanding_balance) > 0 ? 'text-bordeaux-700' : ''}`}>{money(u.outstanding_balance)}</TD>
                <TD className="text-right tabular-nums text-green-700">{Number(u.unapplied_credit) > 0 ? money(u.unapplied_credit) : '—'}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : <p className="rounded border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No units match this filter.</p>}
    </div>
  );
}
