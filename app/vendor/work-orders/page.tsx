import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, Badge, EmptyState } from '@/components/ui/shell';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Completed' },
  { id: 'all', label: 'All' },
] as const;

const OPEN_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress', 'open'];

export default async function VendorWorkOrders({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const me = await requireVendor();
  const sp = await searchParams;
  const filter = (FILTERS.find((f) => f.id === sp.f)?.id ?? 'open') as (typeof FILTERS)[number]['id'];

  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('work_orders')
    .select('id, number, title, status, priority, scheduled_date, completed_date, created_at, associations(name), units(unit_number)')
    .eq('vendor_id', me.vendor_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  const all = data ?? [];
  const rows = all.filter((w: any) => {
    const s = (w.status ?? '').toLowerCase();
    if (filter === 'open') return OPEN_STATUSES.includes(s);
    if (filter === 'done') return !OPEN_STATUSES.includes(s);
    return true;
  });

  return (
    <div>
      <PageHeader title="Work orders" description="Everything assigned to you across all communities." />

      <div className="mb-4 inline-flex rounded-xl border border-gray-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/vendor/work-orders?f=${f.id}`}
            className={
              'flex h-8 items-center justify-center rounded-lg px-4 text-[13px] font-medium transition-colors ' +
              (filter === f.id ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900')
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Surface padded={false}>
        {rows.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={filter === 'open' ? 'No open work orders' : 'Nothing here yet'}
            description="Assignments from your management companies will appear here."
          />
        ) : (
          <ul className="divide-y divide-gray-50">
            {rows.map((w: any) => (
              <li key={w.id}>
                <Link href={`/vendor/work-orders/${w.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50/60 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-gray-900">
                      {w.number ? `#${w.number} · ` : ''}{w.title ?? 'Work order'}
                    </div>
                    <div className="truncate text-[12px] text-gray-500">
                      {[w.associations?.name, w.units?.unit_number && `Unit ${w.units.unit_number}`, w.scheduled_date && `scheduled ${date(w.scheduled_date)}`]
                        .filter(Boolean)
                        .join(' · ') || `created ${date(w.created_at)}`}
                    </div>
                  </div>
                  {w.priority && w.priority !== 'normal' && <Badge tone="danger">{w.priority}</Badge>}
                  <Badge status={w.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}
