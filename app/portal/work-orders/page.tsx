import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
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
  const statusB = (s: string) => {
    const m: Record<string, string> = { open: 'bg-blue-50 text-blue-700', in_progress: 'bg-amber-50 text-amber-700', completed: 'bg-emerald-50 text-emerald-700', closed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-50 text-red-700' }
    return m[s] ?? 'bg-gray-100 text-gray-600'
  }
  const priB = (p: string) => {
    const m: Record<string, string> = { emergency: 'bg-red-50 text-red-700', high: 'bg-orange-50 text-orange-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-blue-50 text-blue-700' }
    return m[p] ?? 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-sm text-gray-500">Track your maintenance and repair requests</p>
        </div>
        <Link href="/portal/work-orders/new" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm">
          <Plus className="h-4 w-4" /> New Request
        </Link>
      </div>

      {all.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-gray-500">No work orders submitted yet.</p>
          <Link href="/portal/work-orders/new" className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-800 font-medium">Submit your first request →</Link>
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 bg-gray-50">
                <th className="px-5 py-3 text-left font-medium">Request</th>
                <th className="px-5 py-3 text-left font-medium">Unit</th>
                <th className="px-5 py-3 text-center font-medium">Priority</th>
                <th className="px-5 py-3 text-center font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {all.map((w: any) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/portal/work-orders/${w.id}`} className="font-medium text-gray-900 hover:text-blue-600">{w.title}</Link>
                    <div className="text-xs text-gray-500 capitalize mt-0.5">{w.category?.replace('_',' ') ?? 'General'}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{w.units?.unit_number ?? '—'}</td>
                  <td className="px-5 py-3 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${priB(w.priority)}`}>{w.priority ?? '—'}</span></td>
                  <td className="px-5 py-3 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusB(w.status)}`}>{w.status.replace('_',' ')}</span></td>
                  <td className="px-5 py-3 text-right text-gray-500 tabular-nums">{date(w.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
