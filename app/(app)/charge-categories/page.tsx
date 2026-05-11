import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ChargeCategoriesPage() {
  const me = await requireStaff();
  const supabase = await createClient();

  const { data: rows } = await (supabase as any)
    .from('charge_categories')
    .select('id, name, code, default_amount, default_frequency, is_assessment, is_fee, is_system, active, archived_at, sort_order')
    .eq('portfolio_id', me.portfolio?.id)
    .is('archived_at', null)
    .order('sort_order')
    .order('name');

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Charge categories</h1>
          <p className="text-sm text-ink-500">The catalog of chargeable items — dues, assessments, fees, amenities. Each unit can subscribe to any of these on a recurring schedule.</p>
        </div>
        <Link href="/charge-categories/new"><Button>+ New category</Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle>{(rows ?? []).length} active categories</CardTitle></CardHeader>
        <CardBody className="p-0">
          <Table>
            <THead><TR>
              <TH>Name</TH><TH>Code</TH>
              <TH className="text-right">Default amount</TH>
              <TH>Frequency</TH>
              <TH>Classification</TH>
              <TH>System</TH>
            </TR></THead>
            <tbody>
              {(rows ?? []).map((c: any) => (
                <TR key={c.id}>
                  <TD className="font-medium"><Link href={`/charge-categories/${c.id}`} className="text-brand-600 hover:underline">{c.name}</Link></TD>
                  <TD className="font-mono text-xs text-ink-600">{c.code ?? '—'}</TD>
                  <TD className="text-right">{money(c.default_amount)}</TD>
                  <TD className="capitalize">{c.default_frequency.replace('_',' ')}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {c.is_assessment && <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-champagne-700">Assessment</span>}
                      {c.is_fee && <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800">Fee</span>}
                    </div>
                  </TD>
                  <TD>{c.is_system ? <span className="text-xs text-ink-500">seeded</span> : <span className="text-xs text-green-700">custom</span>}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
      </div>
    </div>
  );
}
