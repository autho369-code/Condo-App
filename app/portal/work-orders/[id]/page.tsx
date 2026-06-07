import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { notFound } from 'next/navigation'
import { money, date } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerWorkOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  const { id } = await params

  const { data: wo } = await db.from('work_orders')
    .select('id, title, description, category, priority, status, created_at, scheduled_date, completed_date, vendor_id, units!inner(unit_number), vendors(name)')
    .eq('id', id).eq('owner_id', me.owner_id).maybeSingle()

  if (!wo) return notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/portal/work-orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> Back to work orders</Link>

      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{wo.title}</h1>
            <div className="text-sm text-gray-500 mt-1">Unit {wo.units?.unit_number} — {wo.category?.replace('_',' ') ?? 'General'}</div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${wo.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : wo.status === 'in_progress' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{wo.status.replace('_',' ')}</span>
        </div>

        {wo.description && <p className="text-sm text-gray-600 mb-4">{wo.description}</p>}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Priority:</span> <span className="text-gray-900 font-medium capitalize">{wo.priority ?? '—'}</span></div>
          <div><span className="text-gray-500">Vendor:</span> <span className="text-gray-900">{wo.vendors?.name ?? 'Not assigned'}</span></div>
          <div><span className="text-gray-500">Created:</span> <span className="text-gray-900">{date(wo.created_at)}</span></div>
          <div><span className="text-gray-500">Scheduled:</span> <span className="text-gray-900">{wo.scheduled_date ? date(wo.scheduled_date) : 'Not scheduled'}</span></div>
          <div><span className="text-gray-500">Completed:</span> <span className="text-gray-900">{wo.completed_date ? date(wo.completed_date) : '—'}</span></div>
        </div>
      </div>
    </div>
  )
}
