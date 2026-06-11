import Link from 'next/link';
import { Building, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterSelect } from '@/components/operations/filter-bar';
import { EmptyState, Surface } from '@/components/ui/shell';
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
    <DataWorkspace
      title="Units"
      description={`${filtered.length} units · ${money(outstanding)} outstanding.`}
      actions={
        <Link href="/units/new">
          <Button><Plus className="h-4 w-4" /> New unit</Button>
        </Link>
      }
    >
      <div className="space-y-4">
        <Surface padded={false} className="p-3 sm:p-4">
          <form action="/units" method="get" className="flex flex-wrap items-end gap-3">
            <FilterSelect label="Association" name="assoc" defaultValue={assoc ?? ''}>
              <option value="">All associations</option>
              {(assocs ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </FilterSelect>
            <FilterSelect label="View" name="filter" defaultValue={filter ?? ''}>
              <option value="">All units</option>
              <option value="balance">With outstanding balance</option>
              <option value="credit">With credit on file</option>
            </FilterSelect>
            <Button variant="secondary" type="submit">Apply</Button>
          </form>
        </Surface>

        {filtered.length > 0 ? (
          <Table>
            <THead><tr><TH>Association</TH><TH>Unit</TH><TH className="text-right">Charged</TH><TH className="text-right">Paid</TH><TH className="text-right">Balance</TH><TH className="text-right">Credit</TH></tr></THead>
            <tbody>
              {filtered.map((u: any) => (
                <TR key={u.unit_id}>
                  <TD>{u.association_name}</TD>
                  <TD className="font-medium">
                    <Link href={`/units/${u.unit_id}`} className="text-gray-900 hover:text-gray-950 hover:underline">
                      Unit {u.unit_number}
                    </Link>
                  </TD>
                  <TD className="text-right tabular-nums">{money(u.total_charged)}</TD>
                  <TD className="text-right tabular-nums">{money(u.total_paid)}</TD>
                  <TD className={`text-right tabular-nums font-medium ${Number(u.outstanding_balance) > 0 ? 'text-red-700' : ''}`}>{money(u.outstanding_balance)}</TD>
                  <TD className="text-right tabular-nums text-emerald-700">{Number(u.unapplied_credit) > 0 ? money(u.unapplied_credit) : '—'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Building}
              title="No units match this filter"
              description="Adjust the filters or add a new unit."
              action={
                <Link href="/units/new">
                  <Button><Plus className="h-4 w-4" /> New unit</Button>
                </Link>
              }
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
