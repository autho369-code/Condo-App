import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Badge, EmptyState, SectionTitle } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/utils';
import { Plus, Tags } from 'lucide-react';
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

  const categories = rows ?? [];

  return (
    <DataWorkspace
      title="Charge categories"
      description="The catalog of chargeable items — dues, assessments, fees, amenities. Each unit can subscribe to any of these on a recurring schedule."
      actions={
        <Link href="/charge-categories/new">
          <Button><Plus className="h-4 w-4" /> New category</Button>
        </Link>
      }
    >
      <SectionTitle title={`${categories.length} active categories`} />
      {categories.length ? (
        <Table>
          <THead><tr>
            <TH>Name</TH><TH>Code</TH>
            <TH className="text-right">Default amount</TH>
            <TH>Frequency</TH>
            <TH>Classification</TH>
            <TH>System</TH>
          </tr></THead>
          <tbody>
            {categories.map((c: any) => (
              <TR key={c.id}>
                <TD className="font-medium">
                  <Link href={`/charge-categories/${c.id}`} className="text-gray-900 hover:text-gray-950 hover:underline">
                    {c.name}
                  </Link>
                </TD>
                <TD className="font-mono text-xs text-gray-600">{c.code ?? '—'}</TD>
                <TD className="text-right tabular-nums">{money(c.default_amount)}</TD>
                <TD className="capitalize">{c.default_frequency.replace('_', ' ')}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {c.is_assessment && <Badge tone="open">Assessment</Badge>}
                    {c.is_fee && <Badge tone="pending">Fee</Badge>}
                  </div>
                </TD>
                <TD>
                  {c.is_system
                    ? <span className="text-xs text-gray-500">seeded</span>
                    : <span className="text-xs text-emerald-700">custom</span>}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <EmptyState
            icon={Tags}
            title="No charge categories yet"
            description="Create your first category to start billing dues, assessments, and fees."
            action={
              <Link href="/charge-categories/new">
                <Button><Plus className="h-4 w-4" /> New category</Button>
              </Link>
            }
          />
        </div>
      )}
    </DataWorkspace>
  );
}
