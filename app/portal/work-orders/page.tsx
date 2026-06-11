import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerWorkOrdersPage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: wos } = await db.from('work_orders')
    .select('id, title, category, priority, status, created_at, scheduled_date, completed_date, units!inner(unit_number)')
    .eq('owner_id', me.owner_id).is('archived_at', null)
    .order('created_at', { ascending: false }).limit(100)

  const all = wos ?? []
  const priorityTone = (p: string): Tone => {
    const m: Record<string, Tone> = { emergency: 'danger', high: 'warning', medium: 'warning', low: 'info' }
    return m[p] ?? 'neutral'
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Work Orders</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Track your maintenance and repair requests</p>
        </div>
        <Link href="/portal/work-orders/new" className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">
          <Plus className="h-4 w-4" /> New Request
        </Link>
      </div>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-sm text-gray-500">No work orders submitted yet.</p>
          <Link href="/portal/work-orders/new" className="mt-3 inline-block text-sm font-medium text-gray-700 hover:text-gray-950 hover:underline">Submit your first request →</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Request</th>
                <th className="px-5 py-2.5 text-left font-medium">Unit</th>
                <th className="px-5 py-2.5 text-center font-medium">Priority</th>
                <th className="px-5 py-2.5 text-center font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {all.map((w: any) => (
                <tr key={w.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/portal/work-orders/${w.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{w.title}</Link>
                    <div className="mt-0.5 text-xs capitalize text-gray-500">{w.category?.replace('_',' ') ?? 'General'}</div>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-gray-700">{w.units?.unit_number ?? '—'}</td>
                  <td className="px-5 py-3 text-center"><StatusChip tone={priorityTone(w.priority)}>{w.priority ?? '—'}</StatusChip></td>
                  <td className="px-5 py-3 text-center"><Badge status={w.status} /></td>
                  <td className="px-5 py-3 text-right text-[13px] tabular-nums text-gray-700">{date(w.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
