import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import Link from 'next/link'
import { FileText, Image as ImageIcon, File, FolderOpen } from 'lucide-react'
import { isScopedStoragePath } from '@/lib/security/storage-paths'
import { SHARE_LABEL, orderedFolders, type ShareScope } from '@/lib/associations/document-sharing'

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

  // Association documents the manager shared with the board (or with owners).
  // RLS (documents_board_association_read) enforces share_scope.
  const { data: assocDocRows } = ids.length
    ? await db.from('documents')
        .select('id, entity_id, doc_type, file_name, file_url, uploaded_at, folder, share_scope, description')
        .eq('entity_type', 'association')
        .in('entity_id', ids)
        .order('uploaded_at', { ascending: false })
    : { data: [] }
  const assocDocs = (assocDocRows ?? []) as any[]
  const docLinks = new Map<string, string>()
  const toSign = assocDocs.filter((d) => isScopedStoragePath(d.file_url, 'associations', d.entity_id))
  if (toSign.length) {
    try {
      const { data: signed } = await (createServiceClient() as any).storage.from('association-documents')
        .createSignedUrls(toSign.map((d) => d.file_url), 3600)
      const byPath = new Map<string, string>((signed ?? []).filter((x: any) => x?.signedUrl).map((x: any) => [x.path, x.signedUrl]))
      for (const d of toSign) { const u = byPath.get(d.file_url); if (u) docLinks.set(d.id, u) }
    } catch {}
  }
  const docFolders = orderedFolders(assocDocs.map((d) => d.folder))
  const docGroups = [
    ...docFolders.map((f) => ({ folder: f, items: assocDocs.filter((d) => d.folder === f) })),
    { folder: 'Other', items: assocDocs.filter((d) => !d.folder) },
  ].filter((g) => g.items.length > 0)

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

      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-950">Association documents</h2>
          <p className="mt-0.5 text-xs text-gray-500">Files management has shared with the board. “Board and owners” files are also in the owner portal.</p>
        </div>
        {docGroups.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            <FolderOpen className="mx-auto mb-2 h-6 w-6 text-gray-300" />
            No association documents have been shared with the board yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {docGroups.map((g) => (
              <div key={g.folder} className="px-5 py-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{g.folder}</div>
                <ul className="space-y-1.5">
                  {g.items.map((d: any) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        {docLinks.has(d.id)
                          ? <a href={docLinks.get(d.id)} target="_blank" rel="noopener noreferrer" className="truncate text-[13px] font-medium text-gray-900 hover:underline">{d.file_name}</a>
                          : <span className="truncate text-[13px] text-gray-700">{d.file_name}</span>}
                        {d.description && <span className="hidden truncate text-xs text-gray-500 sm:inline">— {d.description}</span>}
                      </div>
                      <span className="text-xs tabular-nums text-gray-500">{SHARE_LABEL[(d.share_scope ?? 'owners') as ShareScope]} · {date(d.uploaded_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
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
                        {d.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <ImageIcon className="h-4 w-4 text-gray-400" /> : <FileText className="h-4 w-4 text-gray-400" />}
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
