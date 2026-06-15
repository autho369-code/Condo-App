import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function OwnerMeetingsPage() {
  await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: meetings } = await db.from('meetings')
    .select('id, title, meeting_type, status, start_time, agenda, minutes, ai_summary')
    .order('start_time', { ascending: false })
    .limit(100)

  const all = meetings ?? []

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Meeting Minutes</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Approved minutes from your association&apos;s meetings</p>
      </div>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-sm text-gray-500">No meeting minutes published yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {all.map((m: any) => (
            <div key={m.id} className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
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
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Summary</div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{m.ai_summary}</p>
                </div>
              ) : null}

              {m.agenda ? (
                <div className="mt-4">
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Agenda</div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{m.agenda}</p>
                </div>
              ) : null}

              <div className="mt-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Minutes</div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{m.minutes}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
