import { CalendarDays } from 'lucide-react';
import { requireTenant } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Badge, EmptyState, PageHeader, Surface } from '@/components/ui/shell';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ResidentMeetingsPage() {
  await requireTenant();
  const supabase = await createClient();
  const { data: meetings } = await (supabase as any)
    .from('meetings')
    .select('id, title, meeting_type, status, start_time, location, agenda, minutes, ai_summary')
    .order('start_time', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader title="Community meetings" description="Upcoming meetings and published minutes from completed meetings." />
      {(meetings ?? []).length === 0 ? (
        <Surface padded={false}><EmptyState icon={CalendarDays} title="No meetings published" description="Scheduled meetings and approved minutes will appear here." /></Surface>
      ) : (
        <div className="space-y-4">
          {(meetings ?? []).map((meeting: any) => (
            <Surface key={meeting.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-950">{meeting.title}</h2>
                  <p className="mt-1 text-xs capitalize text-gray-500">{String(meeting.meeting_type ?? 'meeting').replace(/_/g, ' ')}{meeting.location ? ` · ${meeting.location}` : ''}</p>
                </div>
                <div className="flex items-center gap-2"><span className="text-xs text-gray-500">{date(meeting.start_time, 'long')}</span><Badge status={meeting.status} /></div>
              </div>
              {meeting.ai_summary ? <section className="mt-4"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Summary</div><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{meeting.ai_summary}</p></section> : null}
              {meeting.agenda ? <section className="mt-4"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Agenda</div><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{meeting.agenda}</p></section> : null}
              {meeting.minutes ? <section className="mt-4"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Minutes</div><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{meeting.minutes}</p></section> : null}
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
