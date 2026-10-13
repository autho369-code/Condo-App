import { CalendarDays } from 'lucide-react';
import { requireTenant } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Alert, Badge, EmptyState, PageHeader, Surface } from '@/components/ui/shell';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ResidentMeetingsPage() {
  const me = await requireTenant();
  const supabase = await createClient();
  // The resident rules here too, not RLS alone: a login that is also a board
  // member or staff can read executive sessions and unpublished minutes.
  const { data: meetings, error: meetingsError } = await (supabase as any)
    .from('meetings')
    .select('id, title, meeting_type, status, start_time, location, agenda, minutes, ai_summary')
    .in('association_id', me.tenant_association_ids ?? [])
    .is('archived_at', null)
    .neq('meeting_type', 'executive_session')
    .or('status.in.(scheduled,in_progress),and(status.eq.completed,minutes.not.is.null)')
    .order('start_time', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader title="Community meetings" description="Upcoming meetings and published minutes from completed meetings." />
      {meetingsError ? <Alert tone="danger" title="Could not load meetings">{meetingsError.message}</Alert> : null}
      {(meetings ?? []).length === 0 ? (
        <Surface padded={false}><EmptyState icon={CalendarDays} title="No meetings published" description="Scheduled meetings and approved minutes will appear here." /></Surface>
      ) : (
        <div className="space-y-4">
          {(meetings ?? []).map((meeting: any) => (
            <Surface key={meeting.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">{meeting.title}</h2>
                  <p className="mt-1 text-xs capitalize text-gray-500">{String(meeting.meeting_type ?? 'meeting').replace(/_/g, ' ')}{meeting.location ? ` · ${meeting.location}` : ''}</p>
                </div>
                <div className="flex items-center gap-2"><span className="text-[13px] text-gray-500">{date(meeting.start_time, 'long')}</span><Badge status={meeting.status} /></div>
              </div>
              {meeting.ai_summary ? <section className="mt-4"><div className="text-[13px] font-semibold text-gray-700">Summary</div><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{meeting.ai_summary}</p></section> : null}
              {meeting.agenda ? <section className="mt-4"><div className="text-[13px] font-semibold text-gray-700">Agenda</div><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{meeting.agenda}</p></section> : null}
              {meeting.minutes ? <section className="mt-4"><div className="text-[13px] font-semibold text-gray-700">Minutes</div><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{meeting.minutes}</p></section> : null}
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
