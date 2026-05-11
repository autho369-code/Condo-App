import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ChargesPage() {
  await requireStaff();
  const supabase = await createClient();
  // aged_receivables = one row per open charge (balance_due > 0)
  const { data: rows } = await (supabase as any)
    .from('aged_receivables')
    .select('*')
    .order('due_date');

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Open charges</h1>
      <Table>
        <THead><TR>
          <TH>Unit</TH><TH>Association</TH><TH>Description</TH>
          <TH className="text-right">Balance</TH><TH>Due</TH><TH>Aging</TH>
        </TR></THead>
        <tbody>
          {(rows ?? []).map((c: any) => (
            <TR key={c.charge_id}>
              <TD className="font-medium">{c.unit_number}</TD>
              <TD>{c.association_name}</TD>
              <TD>{c.description}</TD>
              <TD className="text-right font-medium text-bordeaux-600">{money(c.balance_due)}</TD>
              <TD>{date(c.due_date)}</TD>
              <TD><span className={`rounded px-2 py-0.5 text-xs ${
                c.aging_bucket === 'current' ? 'bg-cream-100 text-ink-700'
                : c.aging_bucket === '1_30'   ? 'bg-yellow-100 text-yellow-800'
                : c.aging_bucket === '31_60'  ? 'bg-orange-100 text-orange-800'
                : c.aging_bucket === '61_90'  ? 'bg-red-100 text-red-800'
                : 'bg-red-200 text-red-900'
              }`}>{c.aging_bucket.replace('_', '–')}</span></TD>
            </TR>
          ))}
        </tbody>
      </Table>
      </div>
    </div>
  );
}
