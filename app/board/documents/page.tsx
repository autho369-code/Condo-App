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

  const typePill = 'inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-inset ring-gray-500/15'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Documents</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Association documents, notices, and attachments</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Violation Attachments', value: docs.filter((d: any) => d.type === 'Violation').length },
          { label: 'Work Orders', value: workOrderDocs.length },
          { label: 'Total Documents', value: docs.length + workOrderDocs.length },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.label}</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Document</th>
              <th className="px-4 py-2.5 text-left font-medium">Type</th>
              <th className="px-4 py-2.5 text-left font-medium">Related To</th>
              <th className="px-4 py-2.5 text-left font-medium">Unit</th>
              <th className="px-4 py-2.5 text-right font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && workOrderDocs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">No documents found. Violation photos and attachments will appear here.</td></tr>
            ) : (
              <>
                {docs.map((d: any, i: number) => (
                  <tr key={`vd-${i}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {d.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <Image className="h-4 w-4 text-gray-400" /> : <FileText className="h-4 w-4 text-gray-400" />}
                        {d.url ? <a href={d.url} target="_blank" className="block max-w-[300px] truncate font-medium text-gray-900 hover:text-gray-950 hover:underline">{d.name}</a> : <span className="text-[13px] text-gray-700">{d.name}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={typePill}>{d.type}</span></td>
                    <td className="px-4 py-3">
                      <Link href={`/board/violations/${d.id}`} className="text-[13px] text-gray-700 hover:text-gray-950 hover:underline">{d.related}</Link>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{d.unit}</td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums text-gray-700">{date(d.date)}</td>
                  </tr>
                ))}
                {workOrderDocs.map((w: any) => (
                  <tr key={`wo-${w.id}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-gray-400" />
                        <span className="text-[13px] text-gray-700">Work Order</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={typePill}>Work Order</span></td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{w.title}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{w.units?.unit_number ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums text-gray-700">{date(w.created_at)}</td>
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
