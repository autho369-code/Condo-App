import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { Alert, Surface } from '@/components/ui/shell'

export const dynamic = 'force-dynamic'

export default async function OwnerMeetingsPage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // Mirror the owner rule (meetings_portal_resident_read) explicitly: a board
  // member who is also an owner would otherwise see executive sessions,
  // cancelled meetings and unpublished minutes here through board RLS.
  const assocIds = me.resident_association_ids ?? []
  const { data: meetings, error: meetingsError } = assocIds.length === 0 ? { data: [], error: null } : await db.from('meetings')
    .select('id, title, meeting_type, status, start_time, agenda, minutes, ai_summary')
    .in('association_id', assocIds)
    .is('archived_at', null)
    .neq('meeting_type', 'executive_session')
    .or('status.in.(scheduled,in_progress),and(status.eq.completed,minutes.not.is.null)')
    .order('start_time', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100)

  const all = meetings ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Meeting Minutes</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Approved minutes from your association&apos;s meetings</p>
      </div>

      {meetingsError && <Alert tone="danger" title="Could not load meeting minutes:">{meetingsError.message}. Please refresh.</Alert>}

      {meetingsError ? null : all.length === 0 ? (
        <Surface padded={false} className="px-6 py-12 text-center">
          <p className="text-sm text-gray-500">No meeting minutes published yet.</p>
        </Surface>
      ) : (
        <div className="space-y-4">
          {all.map((m: any) => (
            <Surface key={m.id}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold leading-tight text-gray-950">{m.title}</h2>
                  {m.meeting_type ? (
                    <p className="mt-0.5 text-[13px] capitalize text-gray-500">{String(m.meeting_type).replace(/_/g, ' ')}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[13px] tabular-nums text-gray-500">{date(m.start_time, 'long')}</span>
              </div>

              {m.ai_summary ? (
                <div className="mt-4">
                  <div className="text-[13px] font-medium text-gray-500">Summary</div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{m.ai_summary}</p>
                </div>
              ) : null}

              {m.agenda ? (
                <div className="mt-4">
                  <div className="text-[13px] font-medium text-gray-500">Agenda</div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{m.agenda}</p>
                </div>
              ) : null}

              <div className="mt-4">
                <div className="text-[13px] font-medium text-gray-500">Minutes</div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{m.minutes}</p>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  )
}
