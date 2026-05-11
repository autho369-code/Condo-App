import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function FixedAssetsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('fixed_assets')
    .select('id, name, asset_type, purchase_date, purchase_price, accumulated_depreciation, useful_life_years, status, associations(name)')
    .is('archived_at', null)
    .order('purchase_date', { ascending: false })
    .limit(100);

  return (
    <ModulePage title="Fixed Assets" description="Capital equipment, pool pumps, HVAC systems. Tracked for depreciation and reserve planning.">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Name</TH><TH>Type</TH><TH>Association</TH><TH>Purchased</TH><TH className="text-right">Cost</TH><TH className="text-right">Accum. Dep.</TH><TH>Status</TH></TR></THead>
          <tbody>
            {rows.map((a: any) => (
              <TR key={a.id}>
                <TD className="font-medium">{a.name}</TD>
                <TD className="text-sm capitalize text-ink-700">{a.asset_type}</TD>
                <TD className="text-sm text-ink-700">{a.associations?.name ?? '—'}</TD>
                <TD className="whitespace-nowrap text-sm">{date(a.purchase_date)}</TD>
                <TD className="text-right tabular-nums">{money(a.purchase_price)}</TD>
                <TD className="text-right tabular-nums text-ink-600">{money(a.accumulated_depreciation)}</TD>
                <TD><span className="rounded bg-cream-100 px-2 py-0.5 text-xs capitalize text-ink-700">{a.status ?? 'active'}</span></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No fixed assets tracked.</p>
      )}
    </ModulePage>
  );
}
