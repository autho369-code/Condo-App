import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, Badge, EmptyState } from '@/components/ui/shell';
import { date } from '@/lib/utils';
import { CalendarDays, Wrench, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const OPEN_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress'];

export default async function VendorSchedulePage() {
  const me = await requireVendor();
  const supabase = await createClient();
  const db = supabase as any;
  const todayDate = new Date().toISOString().slice(0, 10);
  const in60 = new Date(Date.now() + 60 * 86400000).toISOString();

  const [{ data: wos }, { data: events }, { data: tasks }] = await Promise.all([
    db.from('work_orders')
      .select('id, number, title, priority, status, scheduled_date, scheduled_time, associations(name), units(unit_number)')
      .eq('vendor_id', me.vendor_id)
      .is('archived_at', null)
      .in('status', OPEN_STATUSES)
      .not('scheduled_date', 'is', null)
      .order('scheduled_date'),
    db.from('calendar_events')
      .select('id, title, start_datetime, location, associations(name)')
      .eq('vendor_id', me.vendor_id)
      .is('archived_at', null)
      .gte('start_datetime', new Date().toISOString())
      .lte('start_datetime', in60)
      .order('start_datetime'),
    db.from('maintenance_tasks')
      .select('id, task_name, next_due_date, associations(name)')
      .eq('vendor_id', me.vendor_id)
      .is('archived_at', null)
      .not('next_due_date', 'is', null)
      .lte('next_due_date', in60.slice(0, 10))
      .order('next_due_date'),
  ]);

  type Item = { key: string; when: string; time?: string | null; title: string; detail: string; kind: 'job' | 'event' | 'recurring'; overdue: boolean; href?: string; status?: string | null };
  const items: Item[] = [
    ...(wos ?? []).map((w: any): Item => ({
      key: `w-${w.id}`,
      when: w.scheduled_date,
      time: w.scheduled_time,
      title: `${w.number ? `#${w.number} · ` : ''}${w.title ?? 'Work order'}`,
      detail: `${w.associations?.name ?? '—'}${w.units?.unit_number ? ` · Unit ${w.units.unit_number}` : ''}${w.priority ? ` · ${w.priority}` : ''}`,
      kind: 'job',
      overdue: w.scheduled_date < todayDate,
      href: `/vendor/work-orders/${w.id}`,
      status: w.status,
    })),
    ...(events ?? []).map((e: any): Item => ({
      key: `e-${e.id}`,
      when: (e.start_datetime ?? '').slice(0, 10),
      title: e.title ?? 'Appointment',
      detail: `${e.associations?.name ?? '—'}${e.location ? ` · ${e.location}` : ''}`,
      kind: 'event',
      overdue: false,
    })),
    ...(tasks ?? []).map((t: any): Item => ({
      key: `t-${t.id}`,
      when: t.next_due_date,
      title: t.task_name ?? 'Recurring maintenance',
      detail: `${t.associations?.name ?? '—'} · recurring`,
      kind: 'recurring',
      overdue: t.next_due_date < todayDate,
    })),
  ].sort((a, b) => a.when.localeCompare(b.when));

  const todays = items.filter((i) => i.when === todayDate);
  const overdue = items.filter((i) => i.overdue);
  const upcoming = items.filter((i) => i.when > todayDate);

  const Section = ({ title, list, tone }: { title: string; list: Item[]; tone?: 'danger' }) => (
    <Surface padded={false} className="mb-5">
      <div className={`border-b border-gray-100 px-5 py-4 sm:px-6 ${tone === 'danger' ? 'bg-red-50/50' : ''}`}>
        <h2 className={`text-sm font-semibold ${tone === 'danger' ? 'text-red-800' : 'text-gray-950'}`}>{title}</h2>
      </div>
      {list.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 sm:px-6">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {list.map((i) => {
            const Icon = i.kind === 'job' ? Wrench : i.kind === 'recurring' ? AlertTriangle : CalendarDays;
            const inner = (
              <div className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4 w-4 text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-gray-900">{i.title}</div>
                  <div className="truncate text-[12px] capitalize text-gray-500">{i.detail}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-[13px] tabular-nums ${i.overdue ? 'font-semibold text-red-700' : 'text-gray-700'}`}>{date(i.when)}</div>
                  {i.time && <div className="text-[11px] text-gray-400">{i.time}</div>}
                  {i.status && <div className="mt-1"><Badge status={i.status} /></div>}
                </div>
              </div>
            );
            return (
              <li key={i.key}>
                {i.href ? <Link href={i.href} className="block transition-colors hover:bg-gray-50/60">{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );

  return (
    <div>
      <PageHeader title="Schedule" description="Your jobs, appointments, and recurring maintenance for the next 60 days." />
      {items.length === 0 ? (
        <Surface padded={false}>
          <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Scheduled jobs and appointments from your management companies will appear here." />
        </Surface>
      ) : (
        <>
          {overdue.length > 0 && <Section title={`Overdue (${overdue.length})`} list={overdue} tone="danger" />}
          <Section title={`Today (${todays.length})`} list={todays} />
          <Section title={`Upcoming (${upcoming.length})`} list={upcoming} />
        </>
      )}
    </div>
  );
}
