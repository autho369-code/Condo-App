import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import '@/components/calendar/calendar-theme.css';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ assoc?: string; type?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: associations } = await db.from('associations').select('id, name').order('name');

  const now = new Date();
  const past = new Date(now.getTime() - 90 * 86_400_000);
  const future = new Date(now.getTime() + 180 * 86_400_000);

  let query = db.from('calendar_events')
    .select('id, title, event_type, start_datetime, end_datetime, all_day, location, operations_status, association_id, public_notice_text, associations(id, name)')
    .gte('start_datetime', past.toISOString()).lte('start_datetime', future.toISOString()).order('start_datetime', { ascending: true }).limit(500);
  if (sp.assoc) query = query.eq('association_id', sp.assoc);
  if (sp.type) query = query.eq('event_type', sp.type);
  const { data: events } = await query;
  const raw = (events ?? []) as any[];

  const rows = raw.map((e: any) => ({ id: e.id, title: e.title, start_datetime: e.start_datetime, end_datetime: e.end_datetime, all_day: e.all_day, event_type: e.event_type, location: e.location, operations_status: e.operations_status, association_name: e.associations?.name ?? null }));

  return (
    <div className="bg-[#f5f6f8] min-h-full">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 tracking-[-0.02em]">Calendar</h1>
            <p className="text-xs text-gray-500 mt-0.5">Month, week, and day views</p>
          </div>
          <Link href={`/calendar/new${sp.assoc ? `?assoc=${sp.assoc}` : ''}`} className="px-4 h-10 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 inline-flex items-center">+ Create event</Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <CalendarGrid events={rows} associations={associations ?? []} initialAssocId={sp.assoc ?? ''} initialType={sp.type ?? ''} />
        </div>
      </div>
    </div>
  );
}
