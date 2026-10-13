import Link from 'next/link';
import { SegmentedLinks } from '@/components/ui/segmented';
import { Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, Badge, EmptyState, Alert } from '@/components/ui/shell';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Completed' },
  { id: 'all', label: 'All' },
] as const;

const OPEN_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress', 'open'];
const PAGE_LIMIT = 200;

export default async function VendorWorkOrders({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; error?: string }>;
}) {
  const me = await requireVendor();
  const sp = await searchParams;
  const filter = (FILTERS.find((f) => f.id === sp.f)?.id ?? 'open') as (typeof FILTERS)[number]['id'];

  const supabase = await createClient();
  // The tab filters in the query: filtering the newest rows afterwards hid
  // older open jobs once a vendor had more than one page of work orders.
  let query = (supabase as any)
    .from('work_orders')
    .select('id, number, title, status, priority, scheduled_date, completed_date, created_at, associations(name), units(unit_number)')
    .in('vendor_id', me.vendor_ids)
    .is('archived_at', null);
  if (filter === 'open') query = query.in('status', OPEN_STATUSES);
  if (filter === 'done') query = query.not('status', 'in', `(${[...OPEN_STATUSES, 'cancelled'].join(',')})`);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(PAGE_LIMIT);

  const rows = data ?? [];

  return (
    <div>
      <PageHeader title="Work orders" description="Everything assigned to you across all communities." />

      {error && <Alert tone="danger" title="Could not load work orders:" className="mb-4">{error.message}</Alert>}
      {sp.error && <Alert tone="danger" className="mb-4">{sp.error}</Alert>}

      <SegmentedLinks label="Show work orders" className="mb-4" current={filter}
        items={FILTERS.map((f) => ({ id: f.id, label: f.label, href: `/vendor/work-orders?f=${f.id}` }))} />

      {rows.length >= PAGE_LIMIT && (
        <p className="mb-3 text-[13px] text-gray-500">Showing the newest {PAGE_LIMIT} work orders.</p>
      )}

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
                  {(w.priority === 'emergency' || w.priority === 'high') && <Badge tone={w.priority === 'emergency' ? 'danger' : 'pending'}>{w.priority}</Badge>}
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
