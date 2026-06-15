import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/shell'
import { date } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerWorkOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  const { id } = await params

  // RLS scopes work_orders to the owner's unit; no owner_id column exists.
  const { data: wo } = await db.from('work_orders')
    .select('id, title, description, category, priority, status, created_at, scheduled_date, completed_date, vendor_id, units!inner(unit_number), vendors(name)')
    .eq('id', id).maybeSingle()

  if (!wo) return notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/portal/work-orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-950"><ArrowLeft className="h-4 w-4" /> Back to work orders</Link>

      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-gray-950">{wo.title}</h1>
            <div className="mt-1 text-sm capitalize text-gray-500">Unit {wo.units?.unit_number} — {wo.category?.replace('_',' ') ?? 'General'}</div>
          </div>
          <Badge status={wo.status} />
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
