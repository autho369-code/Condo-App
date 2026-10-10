import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Badge, Alert } from '@/components/ui/shell'
import { money, date } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function OwnerViolationsPage({ searchParams }: { searchParams: Promise<{ reported?: string; notice?: string }> }) {
  const banner = await searchParams
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: viols, error: violsError } = await db.from('violations')
    .select('id, title, violation_type, status, date_observed, fine_amount, fines_total, hearing_date, hearing_at, units!inner(unit_number)')
    .in('owner_id', me.owner_ids).is('archived_at', null)
    .order('date_observed', { ascending: false }).limit(100)

  const all = viols ?? []
  // Same rule as the detail page: accumulated fines when recorded, else the base fine.
  const fineOf = (v: any) => Number(v.fines_total ?? 0) > 0 ? Number(v.fines_total) : Number(v.fine_amount ?? 0)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Violations</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">View your violation history and status</p>
        </div>
        <Link href="/portal/violations/report" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">
          Report a concern
        </Link>
      </div>

      {banner.reported === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {banner.notice === 'already_submitted'
            ? 'That concern was already sent — we didn’t send a second copy.'
            : 'Thanks — your concern was sent to management for review.'}
        </div>
      )}

      {violsError && <Alert tone="danger" title="Could not load violations:">{violsError.message}</Alert>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Open', value: all.filter((v: any) => !['closed','cured'].includes(v.status)).length },
          { label: 'Total Fines', value: money(all.reduce((s: number, v: any) => s + fineOf(v), 0)) },
          // hearing_at is what the detail page and the hearing workflow set.
          { label: 'Hearings Scheduled', value: all.filter((v: any) => v.hearing_at || v.hearing_date).length },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.label}</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{s.value}</div>
          </div>
        ))}
      </div>

      {violsError ? null : all.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-sm text-gray-500">No violations on your record.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[12.5px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Violation</th>
                <th className="px-5 py-2.5 text-left font-medium">Unit</th>
                <th className="px-5 py-2.5 text-left font-medium">Type</th>
                <th className="px-5 py-2.5 text-center font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Fine</th>
                <th className="px-5 py-2.5 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {all.map((v: any) => (
                <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/portal/violations/${v.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{v.title}</Link>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-gray-700">{v.units?.unit_number ?? '—'}</td>
                  <td className="px-5 py-3 text-[13px] capitalize text-gray-700">{v.violation_type?.replace('_',' ') ?? '—'}</td>
                  <td className="px-5 py-3 text-center"><Badge status={v.status} /></td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-700">{fineOf(v) > 0 ? money(fineOf(v)) : '—'}</td>
                  <td className="px-5 py-3 text-right text-[13px] tabular-nums text-gray-700">{date(v.date_observed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
