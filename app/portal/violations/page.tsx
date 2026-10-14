import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Badge, Alert, Surface } from '@/components/ui/shell'
import { money, date } from '@/lib/utils'
import { buttonClass } from '@/components/ui/button'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { pageCount, pageHref, pageRange, parsePage } from '@/lib/portal/paging'

export const dynamic = 'force-dynamic'

const PATH = '/portal/violations'
// Violations per page; the tiles above the table cover every violation.
const PAGE_SIZE = 50

export default async function OwnerViolationsPage({ searchParams }: { searchParams: Promise<{ reported?: string; notice?: string; page?: string }> }) {
  const banner = await searchParams
  const page = parsePage(banner.page)
  const { from, to } = pageRange(page, PAGE_SIZE)
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // Every query reads the same rows: this login's owner records, not archived,
  // with a unit (the list's inner join).
  const mine = (select: string, opts?: { count: 'exact'; head?: boolean }) =>
    db.from('violations').select(select, opts).in('owner_id', me.owner_ids).is('archived_at', null)
  const [listRes, openRes, hearingRes, finesRes] = await Promise.all([
    mine('id, title, violation_type, status, date_observed, fine_amount, fines_total, hearing_date, hearing_at, units!inner(unit_number)', { count: 'exact' })
      .order('date_observed', { ascending: false }).order('id').range(from, to),
    // Tiles come from their own counts, not the current page.
    mine('id, units!inner(id)', { count: 'exact', head: true }).not('status', 'in', '("closed","cured")'),
    // hearing_at is what the detail page and the hearing workflow set.
    mine('id, units!inner(id)', { count: 'exact', head: true }).or('hearing_at.not.is.null,hearing_date.not.is.null'),
    fetchAllRows<{ fine_amount: number | string | null; fines_total: number | string | null }>(
      () => mine('id, fine_amount, fines_total, units!inner(id)').order('id'),
    ),
  ])

  // A page past the end goes back to the last page (the API refuses a range
  // past the end with PGRST103).
  const total: number = listRes.count ?? (listRes.data ?? []).length
  const pages = pageCount(total, PAGE_SIZE)
  if (page > 1 && (listRes.error?.code === 'PGRST103' || (!listRes.error && page > pages))) {
    redirect(listRes.error ? PATH : pageHref(PATH, pages))
  }
  const violsError = listRes.error
  const tilesError: string | null = openRes.error?.message ?? hearingRes.error?.message ?? finesRes.error ?? null
  const all = listRes.data ?? []
  // Same rule as the detail page: accumulated fines when recorded, else the base fine.
  const fineOf = (v: any) => Number(v.fines_total ?? 0) > 0 ? Number(v.fines_total) : Number(v.fine_amount ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Violations</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">View your violation history and status</p>
        </div>
        <Link href="/portal/violations/report" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">
          Report a concern
        </Link>
      </div>

      {banner.reported === '1' && (
        <Alert tone="success">
          {banner.notice === 'already_submitted'
            ? 'That concern was already sent — we didn’t send a second copy.'
            : 'Thanks — your concern was sent to management for review.'}
        </Alert>
      )}

      {violsError && <Alert tone="danger" title="Could not load violations:">{violsError.message}</Alert>}
      {!violsError && tilesError && <Alert tone="danger" title="Could not load your violation totals:">{tilesError.replace(/\.\s*$/, '')}. Please refresh.</Alert>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Open', value: tilesError ? '—' : (openRes.count ?? 0) },
          { label: 'Total Fines', value: tilesError ? '—' : money(finesRes.rows.reduce((s: number, v: any) => s + fineOf(v), 0)) },
          { label: 'Hearings Scheduled', value: tilesError ? '—' : (hearingRes.count ?? 0) },
        ].map(s => (
          <Surface key={s.label} padded={false} className="px-4 py-3.5">
            <div className="text-[13px] font-medium text-gray-500">{s.label}</div>
            <div className="mt-1.5 font-display text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{s.value}</div>
          </Surface>
        ))}
      </div>

      {violsError ? null : all.length === 0 ? (
        <Surface padded={false} className="px-6 py-12 text-center">
          <p className="text-sm text-gray-500">No violations on your record.</p>
        </Surface>
      ) : (
        <Surface padded={false} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Violation</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Unit</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Type</th>
                <th className="px-5 py-2.5 text-center font-medium">Status</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Fine</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {all.map((v: any) => (
                <tr key={v.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                  <td className="px-5 py-3.5">
                    <Link href={`/portal/violations/${v.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{v.title}</Link>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700">{v.units?.unit_number ?? '—'}</td>
                  <td className="px-5 py-3 text-[13px] capitalize text-gray-700">{v.violation_type?.replace('_',' ') ?? '—'}</td>
                  <td className="px-5 py-3 text-center"><Badge status={v.status} /></td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{fineOf(v) > 0 ? money(fineOf(v)) : '—'}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-sm tabular-nums text-gray-700">{date(v.date_observed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}

      {!violsError && pages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Violations {(from + 1).toLocaleString()}-{Math.min(from + PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}, newest first. The totals above include every violation.
          </p>
          <div className="flex gap-2">
            {page > 1 && <Link href={pageHref(PATH, page - 1)} className={buttonClass('secondary')}>Previous</Link>}
            {page < pages && <Link href={pageHref(PATH, page + 1)} className={buttonClass('secondary')}>Next</Link>}
          </div>
        </div>
      )}
    </div>
  )
}
