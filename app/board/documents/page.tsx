import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import Link from 'next/link'
import { FileText, Image, File } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BoardDocumentsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  // Get violations with attachments
  const { data: violationDocs } = await db
    .from('violations')
    .select('id, title, attachments, created_at, units!inner(unit_number)')
    .in('association_id', ids)
    .is('archived_at', null)
    .not('attachments', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  // Get work orders with attachments (check if column exists)
  let workOrderDocs: any[] = []
  try {
    const { data } = await db
      .from('work_orders')
      .select('id, title, created_at, units!inner(unit_number)')
      .in('association_id', ids)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(50)
    workOrderDocs = data ?? []
  } catch { }

  // Build document list from attachments
  const docs: any[] = []
  for (const v of violationDocs ?? []) {
    const atts = v.attachments
    if (Array.isArray(atts)) {
      for (const a of atts) {
        docs.push({ name: typeof a === 'string' ? a.split('/').pop() : 'Attachment', url: typeof a === 'string' ? a : null, type: 'Violation', related: v.title, unit: v.units?.unit_number, date: v.created_at, id: v.id })
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Documents</h1>
        <p className="mt-1 text-sm text-slate-400">Association documents, notices, and attachments</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Violation Attachments', value: docs.filter((d: any) => d.type === 'Violation').length },
          { label: 'Work Orders', value: workOrderDocs.length },
          { label: 'Total Documents', value: docs.length + workOrderDocs.length },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
            <div className="text-xs font-medium uppercase text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1E293B] overflow-hidden" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Document</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Related To</th>
              <th className="px-4 py-3 text-left font-medium">Unit</th>
              <th className="px-4 py-3 text-right font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {docs.length === 0 && workOrderDocs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No documents found. Violation photos and attachments will appear here.</td></tr>
            ) : (
              <>
                {docs.map((d: any, i: number) => (
                  <tr key={`vd-${i}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {d.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <Image className="h-4 w-4 text-slate-500" /> : <FileText className="h-4 w-4 text-slate-500" />}
                        {d.url ? <a href={d.url} target="_blank" className="font-medium text-slate-200 hover:text-emerald-400 truncate max-w-[300px] block">{d.name}</a> : <span className="text-slate-400">{d.name}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full border border-[#1E293B] px-2 py-0.5 text-xs text-slate-400">{d.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/board/violations/${d.id}`} className="text-slate-400 hover:text-emerald-400">{d.related}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{d.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{date(d.date)}</td>
                  </tr>
                ))}
                {workOrderDocs.map((w: any) => (
                  <tr key={`wo-${w.id}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-slate-500" />
                        <span className="text-slate-400">Work Order</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full border border-[#1E293B] px-2 py-0.5 text-xs text-slate-400">Work Order</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/work-orders/${w.id}`} className="text-slate-400 hover:text-emerald-400">{w.title}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{w.units?.unit_number ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{date(w.created_at)}</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
