import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { loadOwnPortalUnitIds } from '@/lib/portal/own-units'
import { buttonClass } from '@/components/ui/button'
import { pageCount, pageHref, pageRange, parsePage } from '@/lib/portal/paging'
import { ownerTenureCutoffs, tenureFilter } from '../_lib/tenure'
import { Badge, Alert } from '@/components/ui/shell'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PATH = '/portal/work-orders'
// Work orders per page.
const PAGE_SIZE = 50

export default async function OwnerWorkOrdersPage({ searchParams }: { searchParams: Promise<{ error?: string; page?: string }> }) {
  const sp = await searchParams
  const page = parsePage(sp.page)
  const { from, to } = pageRange(page, PAGE_SIZE)
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // Scope to the owner's own units explicitly; RLS also admits board members
  // to every work order in the association. A buyer sees only work orders
  // opened during their tenure, not the seller's.
  const [ownUnits, tenure] = await Promise.all([
    loadOwnPortalUnitIds(db, me.owner_ids),
    ownerTenureCutoffs(db, me.owner_ids),
  ])
  const woScope = tenureFilter(tenure, 'created_at', ownUnits.ids)
  const { data: wos, error: listError, count } = woScope
    ? await db.from('work_orders')
        .select('id, title, category, priority, status, created_at, scheduled_date, completed_date, units!inner(unit_number)', { count: 'exact' })
        .or(woScope)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to)
    : { data: [], error: null, count: 0 }

  // A page past the end goes back to the last page (the API refuses a range
  // past the end with PGRST103).
  const total: number = count ?? (wos ?? []).length
  const pages = pageCount(total, PAGE_SIZE)
  if (page > 1 && (listError?.code === 'PGRST103' || (!listError && page > pages))) {
    redirect(listError ? PATH : pageHref(PATH, pages))
  }
  const loadError: string | null = ownUnits.error ?? tenure.error ?? listError?.message ?? null
  const all = wos ?? []
  const priorityTone = (p: string): Tone => {
    const m: Record<string, Tone> = { emergency: 'danger', high: 'warning', medium: 'warning', low: 'info' }
    return m[p] ?? 'neutral'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Work Orders</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Track your maintenance and repair requests</p>
        </div>
        <Link href="/portal/service-requests/new" className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">
          <Plus className="h-4 w-4" /> New Request
        </Link>
      </div>

      {sp.error && <Alert tone="danger">{sp.error}</Alert>}
      {loadError && <Alert tone="danger" title="Could not load work orders:">{loadError}</Alert>}

      {loadError ? null : all.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-sm text-gray-500">No work orders submitted yet.</p>
          <Link href="/portal/service-requests/new" className="mt-3 inline-block text-sm font-medium text-gray-700 hover:text-gray-950 hover:underline">Submit your first request →</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Request</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Unit</th>
                <th className="px-5 py-2.5 text-center font-medium">Priority</th>
                <th className="px-5 py-2.5 text-center font-medium">Status</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {all.map((w: any) => (
                <tr key={w.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                  <td className="px-5 py-3.5">
                    <Link href={`/portal/work-orders/${w.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{w.title}</Link>
                    <div className="mt-0.5 text-xs capitalize text-gray-500">{w.category?.replace('_',' ') ?? 'General'}</div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700">{w.units?.unit_number ?? '—'}</td>
                  <td className="px-5 py-3 text-center"><StatusChip tone={priorityTone(w.priority)}>{w.priority ?? '—'}</StatusChip></td>
                  <td className="px-5 py-3 text-center"><Badge status={w.status} /></td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-sm tabular-nums text-gray-700">{date(w.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loadError && pages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Work orders {(from + 1).toLocaleString()}-{Math.min(from + PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}, newest first.
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
