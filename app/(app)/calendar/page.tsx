import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, Surface } from '@/components/ui/shell';
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
    <PageShell>
      <PageHeader
        title="Calendar"
        description="Month, week, and day views"
        actions={
          <Link href={`/calendar/new${sp.assoc ? `?assoc=${sp.assoc}` : ''}`}>
            <Button><Plus className="h-4 w-4" /> Create event</Button>
          </Link>
        }
      />
      <Surface padded={false} className="overflow-hidden">
        <CalendarGrid events={rows} associations={associations ?? []} initialAssocId={sp.assoc ?? ''} initialType={sp.type ?? ''} />
      </Surface>
    </PageShell>
  );
}
