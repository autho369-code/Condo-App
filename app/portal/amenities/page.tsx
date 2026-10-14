import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Alert, Badge, SectionTitle, Surface } from '@/components/ui/shell'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { PendingSubmit } from '@/components/ui/pending-submit'
import { zonedWallTimeToUtc } from '@/lib/time/zoned'
import { buttonClass } from '@/components/ui/button'
import { amenityEndsNextDay, amenityPriceLabel, amenityReserveAction, nextCalendarDate, withinAmenityHours } from '@/lib/amenities/portal'

const DEFAULT_TZ = 'America/Chicago'

export const dynamic = 'force-dynamic'

type Amenity = {
  id: string
  name: string
  association_id: string
  description_html: string | null
  opens_at: string | null
  closes_at: string | null
  allow_reservations: boolean | null
  pricing_mode: string | null
  price_amount: number | string | null
  reserve_method: string | null
  reservation_email: string | null
  reservation_url: string | null
}

type Reservation = {
  id: string
  status: string
  start_time: string
  end_time: string
  party_size: number | null
  notes: string | null
  association_id: string | null
  association_amenities: { name: string | null } | null
}

// Server components render in UTC; show times in the community's own zone.
function fmtDateTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone, weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function fmtTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

// A reservation that ends on a later local day (late-night hours) shows the
// end date too.
function fmtRange(startIso: string, endIso: string, timeZone: string): string {
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone })
  const end = day(startIso) === day(endIso)
    ? fmtTime(endIso, timeZone)
    : new Date(endIso).toLocaleString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  return `${fmtDateTime(startIso, timeZone)} – ${end}`
}

function fmtHours(opens: string | null, closes: string | null): string | null {
  if (!opens && !closes) return null
  const fmt = (t: string | null) => {
    if (!t) return '—'
    const [h, m] = t.split(':').map(Number)
    const hr12 = h % 12 || 12
    return `${hr12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  }
  return `${fmt(opens)} – ${fmt(closes)}`
}

// ── Request a reservation ────────────────────────────────────────────────────
async function requestReservation(formData: FormData) {
  'use server'
  const failTo = (msg: string) =>
    redirect('/portal/amenities?error=' + encodeURIComponent(msg))

  const me = await requireOwner()
  if (!me.owner_ids.length) { failTo('Only owners can request a reservation'); return }

  const amenityId = String(formData.get('amenity_id') ?? '')
  const date = String(formData.get('date') ?? '')
  const startTime = String(formData.get('start_time') ?? '')
  const endTime = String(formData.get('end_time') ?? '')
  const partyRaw = String(formData.get('party_size') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!amenityId) { failTo('Please choose an amenity'); return }
  if (!date) { failTo('Please choose a date'); return }
  if (!startTime || !endTime) { failTo('Please choose a start and end time'); return }

  const supabase = await createClient()
  const db = supabase as any

  // Resolve the amenity and its association server-side — never trust the client.
  // RLS on association_amenities already scopes this to the owner's associations.
  const { data: amenity, error: aErr } = await db
    .from('association_amenities')
    .select('id, association_id, allow_reservations, archived_at, reserve_method, reservation_email, reservation_url, opens_at, closes_at, associations(timezone)')
    .eq('id', amenityId)
    .maybeSingle()
  if (aErr || !amenity) { failTo('Amenity not found or unavailable'); return }
  if (amenity.archived_at) { failTo('That amenity is no longer available'); return }
  if (!amenity.allow_reservations) { failTo('That amenity does not accept reservations'); return }
  // Staff chose how this amenity is reserved: email or the reservation
  // platform link are used instead of a request here.
  if (amenityReserveAction(amenity).kind !== 'request') { failTo('That amenity is reserved by email or online, not through a request here'); return }
  if (!withinAmenityHours(startTime, endTime, amenity.opens_at, amenity.closes_at)) {
    failTo(`That time is outside the amenity's hours (${fmtHours(amenity.opens_at, amenity.closes_at)})`); return
  }

  // The owner types times in their community's zone; the server runs in UTC.
  const timeZone = amenity.associations?.timezone || DEFAULT_TZ
  const start = zonedWallTimeToUtc(date, startTime, timeZone)
  // Ending at midnight, or past midnight for late-night hours, ends the next day.
  const endDate = amenityEndsNextDay(startTime, endTime, amenity.opens_at, amenity.closes_at) ? nextCalendarDate(date) : date
  const end = endDate ? zonedWallTimeToUtc(endDate, endTime, timeZone) : null
  if (!start || !end) { failTo('That date/time is not valid'); return }
  if (end <= start) { failTo('End time must be after the start time'); return }
  if (start < new Date()) { failTo('Please pick a time in the future'); return }

  // Resolve the owner record, unit and portfolio from the login's own current
  // occupancy in this association (one owner record per association; an owner
  // who is also on the board can read every unit there).
  const { data: occRow, error: occErr } = await db
    .from('occupancies')
    .select('owner_id, unit_id, associations(portfolio_id)')
    .in('owner_id', me.owner_ids)
    .eq('association_id', amenity.association_id)
    .eq('status', 'current')
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (occErr) { failTo(`Could not check your unit: ${occErr.message}`); return }
  const occ = occRow?.owner_id && occRow?.unit_id && occRow?.associations?.portfolio_id
    ? { owner_id: occRow.owner_id as string, unit_id: occRow.unit_id as string, portfolio_id: occRow.associations.portfolio_id as string }
    : null
  if (!occ) { failTo('You need a unit in this community to reserve its amenities'); return }

  let partySize: number | null = null
  if (partyRaw) {
    const n = parseInt(partyRaw, 10)
    if (!Number.isNaN(n) && n > 0) partySize = n
  }

  const { error } = await db.from('amenity_reservations').insert({
    amenity_id: amenity.id,
    association_id: amenity.association_id,
    portfolio_id: occ.portfolio_id,
    unit_id: occ.unit_id,
    owner_id: occ.owner_id,
    reserved_by: me.auth_user_id,
    reserved_for_name: me.profile?.full_name ?? null,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    party_size: partySize,
    status: 'pending',
    notes,
  })

  if (error) { failTo(error.message || 'Could not submit your request'); return }

  revalidatePath('/portal/amenities')
  redirect('/portal/amenities?requested=1')
}

// ── Cancel a reservation ─────────────────────────────────────────────────────
async function cancelReservation(formData: FormData) {
  'use server'
  const failTo = (msg: string) =>
    redirect('/portal/amenities?error=' + encodeURIComponent(msg))

  const me = await requireOwner()
  if (!me.owner_ids.length) { failTo('Only owners can cancel a reservation'); return }

  const id = String(formData.get('reservation_id') ?? '')
  if (!id) { failTo('Missing reservation'); return }

  const supabase = await createClient()
  const db = supabase as any
  // RLS (amenity_res_resident_cancel) enforces own + pending/approved → cancelled.
  const { data: cancelled, error } = await db
    .from('amenity_reservations')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .in('owner_id', me.owner_ids)
    .select('id')

  if (error) { failTo(error.message || 'Could not cancel that reservation'); return }
  if (!cancelled || cancelled.length === 0) { failTo('That reservation can no longer be cancelled. Contact your management company.'); return }

  revalidatePath('/portal/amenities')
  redirect('/portal/amenities?cancelled=1')
}

export default async function OwnerAmenitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; requested?: string; cancelled?: string }>
}) {
  const sp = await searchParams
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // Bookable amenities for the owner's association(s) — RLS scopes the rows.
  const { data: amenityRows } = await db
    .from('association_amenities')
    .select('id, name, association_id, description_html, opens_at, closes_at, allow_reservations, pricing_mode, price_amount, reserve_method, reservation_email, reservation_url')
    .eq('allow_reservations', true)
    .is('archived_at', null)
    .order('name')
  const amenities = (amenityRows ?? []) as Amenity[]
  // Each amenity is reserved the way staff configured it.
  const requestable = amenities.filter((a) => amenityReserveAction(a).kind === 'request')

  // The owner's own reservations.
  const { data: resRows } = await db
    .from('amenity_reservations')
    .select('id, status, start_time, end_time, party_size, notes, association_id, association_amenities(name)')
    .in('owner_id', me.owner_ids)
    .order('start_time', { ascending: false })
    .limit(100)
  const reservations = (resRows ?? []) as Reservation[]

  const assocIds = [...new Set([...amenities.map((a) => a.association_id), ...reservations.map((r) => r.association_id)].filter(Boolean))] as string[]
  const { data: zoneRows } = assocIds.length > 0
    ? await db.from('associations').select('id, timezone').in('id', assocIds)
    : { data: [] }
  const zones: Record<string, string> = Object.fromEntries((zoneRows ?? []).map((z: any) => [z.id, z.timezone || DEFAULT_TZ]))

  const now = Date.now()
  const upcoming = reservations.filter((r) => new Date(r.end_time).getTime() >= now)
  const past = reservations.filter((r) => new Date(r.end_time).getTime() < now)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Amenities</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Request a reservation, or use the email or link shown for each amenity.
        </p>
      </div>

      {sp.error && <Alert tone="danger" title="Could not submit">{sp.error}</Alert>}
      {sp.requested === '1' && <Alert tone="success">Thanks — your reservation request was sent to management for review.</Alert>}
      {sp.cancelled === '1' && <Alert tone="info">Your reservation was cancelled.</Alert>}

      {/* Bookable amenities, each with the way staff set it to be reserved */}
      {amenities.length > 0 && (
        <Surface padded={false}>
          <div className="px-5 pt-5">
            <SectionTitle title="Bookable amenities" description="Hours, prices and how to reserve, as your management team set them." />
          </div>
          <ul className="divide-y divide-gray-100">
            {amenities.map((a) => {
              const action = amenityReserveAction(a)
              const hrs = fmtHours(a.opens_at, a.closes_at)
              const price = amenityPriceLabel(a.pricing_mode, a.price_amount)
              return (
                <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{a.name}</div>
                    <div className="text-[13px] text-gray-500">
                      {[hrs ? `Hours ${hrs}` : null, price].filter(Boolean).join(' · ') || 'Reservations accepted'}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {action.kind === 'email' && (
                      <a href={`mailto:${action.email}?subject=${encodeURIComponent(`Reservation request: ${a.name}`)}`} className={buttonClass('secondary')}>
                        Reserve by email
                      </a>
                    )}
                    {action.kind === 'link' && (
                      <a href={action.url} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
                        Reserve online
                      </a>
                    )}
                    {action.kind === 'request' && <span className="text-[13px] text-gray-500">Request below</span>}
                    {action.kind === 'none' && <span className="text-[13px] text-gray-500">Contact your management team to reserve</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        </Surface>
      )}

      {/* Request form */}
      <section className="space-y-3">
        <SectionTitle title="Request a reservation" />
        {requestable.length === 0 ? (
          <Surface>
            <p className="text-sm text-gray-600">
              {amenities.length === 0
                ? 'No bookable amenities are available for your community yet. Check back later or contact your management team.'
                : 'Your community’s amenities are reserved by email or online. Use the links above.'}
            </p>
          </Surface>
        ) : (
          <Surface>
            <form action={requestReservation} className="space-y-5">
              <Field label="Amenity" required>
                <Select name="amenity_id" required defaultValue="">
                  <option value="">Choose an amenity…</option>
                  {requestable.map((a) => {
                    const hrs = fmtHours(a.opens_at, a.closes_at)
                    return (
                      <option key={a.id} value={a.id}>
                        {a.name}{hrs ? ` (${hrs})` : ''}
                      </option>
                    )
                  })}
                </Select>
              </Field>

              <div className="space-y-1.5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Date" required>
                    <Input type="date" name="date" required />
                  </Field>
                  <Field label="Start" required>
                    <Input type="time" name="start_time" required />
                  </Field>
                  <Field label="End" required>
                    <Input type="time" name="end_time" required />
                  </Field>
                </div>
                <p className="text-[13px] leading-5 text-gray-500">
                  For an amenity open past midnight, an end time earlier than the start ends the next day.
                </p>
              </div>

              <Field label="Party size" className="max-w-[200px]">
                <Input type="number" name="party_size" min={1} placeholder="Optional" />
              </Field>

              <Field label="Notes">
                <Textarea
                  name="notes"
                  rows={3}
                  placeholder="Anything management should know (event type, guests, setup needs)…"
                />
              </Field>

              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <PendingSubmit pendingLabel="Sending…">Request reservation</PendingSubmit>
              </div>
            </form>
          </Surface>
        )}
      </section>

      {/* My reservations */}
      <section className="space-y-3">
        <SectionTitle title="My reservations" />
        {reservations.length === 0 ? (
          <Surface>
            <p className="text-sm text-gray-500">You have no reservations yet.</p>
          </Surface>
        ) : (
          <div className="space-y-4">
            <ReservationList title="Upcoming" rows={upcoming} zones={zones} cancelAction={cancelReservation} allowCancel />
            <ReservationList title="Past" rows={past} zones={zones} cancelAction={cancelReservation} allowCancel={false} />
          </div>
        )}
      </section>
    </div>
  )
}

function ReservationList({
  title, rows, zones, cancelAction, allowCancel,
}: {
  title: string
  rows: Reservation[]
  zones: Record<string, string>
  cancelAction: (formData: FormData) => void
  allowCancel: boolean
}) {
  if (rows.length === 0) return null
  return (
    <Surface padded={false}>
      <div className="px-5 pt-5">
        <SectionTitle title={title} />
      </div>
      <ul className="divide-y divide-gray-50">
        {rows.map((r) => {
          const cancellable = allowCancel && ['pending', 'approved'].includes(r.status)
          const tz = (r.association_id && zones[r.association_id]) || DEFAULT_TZ
          return (
            <li key={r.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">{r.association_amenities?.name ?? 'Amenity'}</div>
                <div className="text-[13px] text-gray-500">
                  {fmtRange(r.start_time, r.end_time, tz)}
                  {r.party_size ? ` · party of ${r.party_size}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge status={r.status} />
                {cancellable && (
                  <form action={cancelAction}>
                    <input type="hidden" name="reservation_id" value={r.id} />
                    <PendingSubmit variant="secondary" size="sm" pendingLabel="Cancelling…" confirm="Cancel this reservation?">
                      Cancel reservation
                    </PendingSubmit>
                  </form>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Surface>
  )
}
