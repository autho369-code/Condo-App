import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { FileText, FolderOpen } from 'lucide-react'
import { Alert } from '@/components/ui/shell'
import { isScopedStoragePath } from '@/lib/security/storage-paths'
import { SHARE_LABEL, orderedFolders, type ShareScope } from '@/lib/associations/document-sharing'

export const dynamic = 'force-dynamic'

// Governing documents only: the files management has shared with the board.
// The board portal does not show violations, owners or other operational files.
export default async function BoardDocumentsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  // RLS (documents_board_association_read) enforces share_scope.
  const { data: assocDocRows, error: assocDocsError } = ids.length
    ? await db.from('documents')
        .select('id, entity_id, doc_type, file_name, file_url, uploaded_at, folder, share_scope, description')
        .eq('entity_type', 'association')
        .in('entity_id', ids)
        .order('uploaded_at', { ascending: false })
    : { data: [], error: null }
  const assocDocs = (assocDocRows ?? []) as any[]
  const docLinks = new Map<string, string>()
  let signError: string | null = null
  const toSign = assocDocs.filter((d) => isScopedStoragePath(d.file_url, 'associations', d.entity_id))
  if (toSign.length) {
    const { data: signed, error } = await (createServiceClient() as any).storage.from('association-documents')
      .createSignedUrls(toSign.map((d) => d.file_url), 3600)
    if (error) signError = error.message
    const byPath = new Map<string, string>((signed ?? []).filter((x: any) => x?.signedUrl).map((x: any) => [x.path, x.signedUrl]))
    for (const d of toSign) { const u = byPath.get(d.file_url); if (u) docLinks.set(d.id, u) }
  }
  const docFolders = orderedFolders(assocDocs.map((d) => d.folder))
  const docGroups = [
    ...docFolders.map((f) => ({ folder: f, items: assocDocs.filter((d) => d.folder === f) })),
    { folder: 'Other', items: assocDocs.filter((d) => !d.folder) },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Governing Documents</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Bylaws, declarations, rules and other documents shared with the board</p>
      </div>

      {assocDocsError && <Alert tone="danger" title="Documents could not be loaded">{assocDocsError.message}</Alert>}
      {signError && <Alert tone="danger" title="Download links could not be created">{signError}</Alert>}

      <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {docGroups.length === 0 && !assocDocsError ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            <FolderOpen className="mx-auto mb-2 h-6 w-6 text-gray-300" />
            No documents have been shared with the board yet.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {docGroups.map((g) => (
              <div key={g.folder} className="px-5 py-3.5">
                <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-gray-500">{g.folder}</div>
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
    </div>
  )
}
