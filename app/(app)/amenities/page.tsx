import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/me'
import { DataWorkspace } from '@/components/operations/data-workspace'
import { Badge, EmptyState, SectionTitle, Surface } from '@/components/ui/shell'
import { CalendarCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Reservation = {
  id: string
  status: string
  start_time: string
  end_time: string
  party_size: number | null
  reserved_for_name: string | null
  notes: string | null
  association_amenities: { name: string | null } | null
  associations: { name: string | null } | null
  units: { unit_number: string | null } | null
}

type Amenity = {
  id: string
  name: string
  allow_reservations: boolean
  associations: { name: string | null } | null
}

function fmtRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const datePart = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${datePart}, ${t(start)} – ${t(end)}`
}

// ── Approve / deny a reservation ─────────────────────────────────────────────
async function setStatus(formData: FormData) {
  'use server'
  const failTo = (msg: string) =>
    redirect('/amenities?error=' + encodeURIComponent(msg))

  await requireStaff()
  const id = String(formData.get('reservation_id') ?? '')
  const next = String(formData.get('next_status') ?? '')
  if (!id) { failTo('Missing reservation'); return }
  if (!['approved', 'denied'].includes(next)) { failTo('Invalid action'); return }

  const supabase = await createClient()
  const db = supabase as any
  // RLS (amenity_res_staff_all) scopes this to associations the manager can access.
  const { error } = await db
    .from('amenity_reservations')
    .update({ status: next })
    .eq('id', id)

  if (error) { failTo(error.message || 'Could not update the reservation'); return }
  revalidatePath('/amenities')
  redirect('/amenities?updated=1')
}

// ── Toggle whether an amenity is bookable ────────────────────────────────────
async function toggleBookable(formData: FormData) {
  'use server'
  const failTo = (msg: string) =>
    redirect('/amenities?error=' + encodeURIComponent(msg))

  await requireStaff()
  const id = String(formData.get('amenity_id') ?? '')
  const next = String(formData.get('next_bookable') ?? '') === 'true'
  if (!id) { failTo('Missing amenity'); return }

  const supabase = await createClient()
  const db = supabase as any
  const { error } = await db
    .from('association_amenities')
    .update({ allow_reservations: next })
    .eq('id', id)

  if (error) { failTo(error.message || 'Could not update the amenity'); return }
  revalidatePath('/amenities')
  redirect('/amenities?updated=1')
}

export default async function ManagerAmenitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>
}) {
  const sp = await searchParams
  await requireStaff()
  const supabase = await createClient()
  const db = supabase as any

  // Reservations across the manager's portfolio (RLS-scoped). Newest first.
  const { data: resRows } = await db
    .from('amenity_reservations')
    .select('id, status, start_time, end_time, party_size, reserved_for_name, notes, association_amenities(name), associations:association_id(name), units(unit_number)')
    .order('start_time', { ascending: true })
    .limit(300)
  const reservations = (resRows ?? []) as Reservation[]

  const now = Date.now()
  const pending = reservations.filter((r) => r.status === 'pending')
  const upcomingApproved = reservations.filter(
    (r) => r.status === 'approved' && new Date(r.end_time).getTime() >= now,
  )

  // Amenities the manager controls (RLS-scoped), for the bookable toggle list.
  const { data: amRows } = await db
    .from('association_amenities')
    .select('id, name, allow_reservations, associations:association_id(name)')
    .is('archived_at', null)
    .order('name')
  const amenities = (amRows ?? []) as Amenity[]

  return (
    <DataWorkspace
      title="Amenities"
      description="Review reservation requests and choose which amenities residents can book."
    >
      {sp.error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Error:</span> {sp.error}
        </div>
      )}
      {sp.updated === '1' && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Updated.
        </div>
      )}

      {/* Pending queue */}
      <div className="mb-8">
        <SectionTitle title="Pending requests" />
        <Surface className="mt-3 overflow-hidden p-0">
          {pending.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No pending requests"
              description="Reservation requests from residents will appear here for review."
            />
          ) : (
            <ReservationTable rows={pending} mode="pending" action={setStatus} />
          )}
        </Surface>
      </div>

      {/* Upcoming approved */}
      {upcomingApproved.length > 0 && (
        <div className="mb-8">
          <SectionTitle title="Upcoming approved" />
          <Surface className="mt-3 overflow-hidden p-0">
            <ReservationTable rows={upcomingApproved} mode="approved" action={setStatus} />
          </Surface>
        </div>
      )}

      {/* Bookable toggles */}
      <div>
        <SectionTitle title="Bookable amenities" description="Turn an amenity on to let residents request reservations for it." />
        <Surface className="mt-3 overflow-hidden p-0">
          {amenities.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No amenities yet"
              description="Add amenities from an association's Amenities tab to make them bookable."
            />
          ) : (
            <ul className="divide-y divide-gray-50">
              {amenities.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">{a.name}</div>
                    <div className="truncate text-[12px] text-gray-500">{a.associations?.name ?? '—'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={a.allow_reservations ? 'complete' : 'inactive'}>
                      {a.allow_reservations ? 'Bookable' : 'Off'}
                    </Badge>
                    <form action={toggleBookable}>
                      <input type="hidden" name="amenity_id" value={a.id} />
                      <input type="hidden" name="next_bookable" value={(!a.allow_reservations).toString()} />
                      <button type="submit" className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50">
                        {a.allow_reservations ? 'Disable' : 'Enable'}
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </DataWorkspace>
  )
}

function ReservationTable({
  rows, mode, action,
}: {
  rows: Reservation[]
  mode: 'pending' | 'approved'
  action: (formData: FormData) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-5 py-2.5 text-left font-medium">Amenity</th>
            <th className="px-5 py-2.5 text-left font-medium">Association</th>
            <th className="px-5 py-2.5 text-left font-medium">Requested by</th>
            <th className="px-5 py-2.5 text-left font-medium">When</th>
            <th className="px-5 py-2.5 text-center font-medium">Status</th>
            <th className="px-5 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-50 last:border-0 align-top">
              <td className="px-5 py-3 font-medium text-gray-900">{r.association_amenities?.name ?? '—'}</td>
              <td className="px-5 py-3 text-[13px] text-gray-700">{r.associations?.name ?? '—'}</td>
              <td className="px-5 py-3 text-[13px] text-gray-700">
                {r.reserved_for_name ?? '—'}
                {r.units?.unit_number ? <span className="text-gray-400"> · Unit {r.units.unit_number}</span> : null}
                {r.party_size ? <div className="text-[12px] text-gray-400">Party of {r.party_size}</div> : null}
                {r.notes ? <div className="mt-0.5 max-w-xs text-[12px] text-gray-500">{r.notes}</div> : null}
              </td>
              <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{fmtRange(r.start_time, r.end_time)}</td>
              <td className="px-5 py-3 text-center"><Badge status={r.status} /></td>
              <td className="px-5 py-3 text-right">
                {mode === 'pending' ? (
                  <div className="flex items-center justify-end gap-2">
                    <form action={action}>
                      <input type="hidden" name="reservation_id" value={r.id} />
                      <input type="hidden" name="next_status" value="approved" />
                      <button type="submit" className="rounded-lg bg-gray-950 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-gray-800">
                        Approve
                      </button>
                    </form>
                    <form action={action}>
                      <input type="hidden" name="reservation_id" value={r.id} />
                      <input type="hidden" name="next_status" value="denied" />
                      <button type="submit" className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50">
                        Deny
                      </button>
                    </form>
                  </div>
                ) : (
                  <span className="text-[13px] text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
