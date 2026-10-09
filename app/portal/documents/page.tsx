import Link from 'next/link'
import { ClipboardList, FileText, Scale, Users, File } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { loadOwnPortalUnitIds, unitFilter } from '@/lib/portal/own-units'
import { date } from '@/lib/utils'
import { Alert } from '@/components/ui/shell'
import { isEntityDocumentStoragePath } from '@/lib/security/storage-paths'
import { signFormFiles } from '@/lib/forms/files'

export const dynamic = 'force-dynamic'

// Storage bucket holding uploaded association/owner/unit documents.
// Matches the bucket used by the manager owner-detail page (createSignedUrls).
const BUCKET = 'association-documents'

type DocRow = {
  id: string
  doc_type: string | null
  entity_type: string | null
  entity_id: string | null
  file_name: string | null
  file_url: string | null
  uploaded_at: string | null
  expires_at: string | null
}

// Visual buckets shown to owners. Order matters (rendered top-to-bottom).
const BUCKETS = [
  { key: 'governing', title: 'Governing Documents', icon: Scale },
  { key: 'owner', title: 'Owner Documents', icon: FileText },
  { key: 'meeting', title: 'Meeting Records', icon: Users },
  { key: 'other', title: 'Other documents', icon: File },
] as const

type BucketKey = (typeof BUCKETS)[number]['key']

// Map a free-form doc_type into one of the visual buckets. doc_type values are
// not enumerated in the schema (they come from template letter_types and form
// names, e.g. "violation_notice", "welcome_letter", "board_packet",
// "declaration"), so we categorize by keyword and fall back to "Other".
function bucketFor(docType: string | null): BucketKey {
  const t = (docType ?? '').toLowerCase()
  if (/declarat|bylaw|cc&?r|covenant|rule|regulation|amendment|governing|article|charter/.test(t)) {
    return 'governing'
  }
  if (/meeting|minute|agenda|notice|annual|board[_ -]?packet|resolution/.test(t)) {
    return 'meeting'
  }
  if (/welcome|form|parking|move[_ -]?in|move[_ -]?out|insurance|lease|owner|assessment|letter|violation/.test(t)) {
    return 'owner'
  }
  return 'other'
}

export default async function OwnerDocumentsPage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // Scope explicitly to what an owner may see: their own owner record, their
  // own units, and association documents shared with owners. Relying on RLS
  // alone showed board-only association documents to board members who are
  // also owners.
  const ownUnits = await loadOwnPortalUnitIds(db, me.owner_ids)
  const myUnits = unitFilter(ownUnits.ids)
  const assocIds = (me.resident_association_ids ?? []).length ? me.resident_association_ids : ['00000000-0000-0000-0000-000000000000']
  const { data, error: docsError } = await db
    .from('documents')
    .select('id, doc_type, entity_type, entity_id, file_name, file_url, uploaded_at, expires_at')
    .or([
      `and(entity_type.eq.owner,entity_id.in.(${me.owner_ids.join(',')}))`,
      `and(entity_type.eq.unit,entity_id.in.(${myUnits.join(',')}))`,
      `and(entity_type.eq.association,share_scope.eq.owners,entity_id.in.(${assocIds.join(',')}))`,
    ].join(','))
    .order('uploaded_at', { ascending: false })
  const docs = (data ?? []) as DocRow[]

  // Forms the management company publishes to homeowners. Filtered
  // explicitly (not only by RLS) so an owner who is also staff sees just the
  // homeowner forms of their own management company.
  const { data: ownerRow } = await db.from('owners').select('portfolio_id').in('id', me.owner_ids).limit(1).maybeSingle()
  const { data: formRows, error: formsError } = ownerRow?.portfolio_id
    ? await db.from('form_templates')
        .select('id, portfolio_id, name, description, file_url, file_path, file_name')
        .eq('portfolio_id', ownerRow.portfolio_id)
        .eq('audience', 'homeowner')
        .eq('active', true)
        .is('archived_at', null)
        .order('name')
    : { data: [], error: null }
  const loadError = (ownUnits.error ? { message: ownUnits.error } : null) ?? docsError ?? formsError
  const forms = (formRows ?? []) as Array<{ id: string; portfolio_id: string; name: string; description: string | null; file_url: string | null; file_path: string | null; file_name: string | null }>
  const formLinks = await signFormFiles(forms, 3600)

  // Resolve viewable links. file_url may be a full https URL (link directly) or
  // a storage object path in a private bucket (needs a signed URL).
  const linkByDoc = new Map<string, string>()
  const pathsToSign: string[] = []
  for (const d of docs) {
    const url = d.file_url?.trim()
    if (!url) continue
    if (/^https?:\/\//i.test(url)) {
      linkByDoc.set(d.id, url)
    } else if (isEntityDocumentStoragePath(url, d.entity_type, d.entity_id)) {
      pathsToSign.push(url)
    }
  }
  if (pathsToSign.length > 0) {
    const svc = createServiceClient() as any
    const { data: signed } = await svc.storage.from(BUCKET).createSignedUrls(pathsToSign, 3600)
    const signedByPath = new Map<string, string>()
    for (const s of signed ?? []) {
      if (s?.path && s?.signedUrl) signedByPath.set(s.path, s.signedUrl)
    }
    for (const d of docs) {
      const url = d.file_url?.trim()
      if (url && !linkByDoc.has(d.id)) {
        const signedUrl = signedByPath.get(url)
        if (signedUrl) linkByDoc.set(d.id, signedUrl)
      }
    }
  }

  // Group into visual buckets.
  const grouped = new Map<BucketKey, DocRow[]>()
  for (const b of BUCKETS) grouped.set(b.key, [])
  for (const d of docs) grouped.get(bucketFor(d.doc_type))!.push(d)

  const now = Date.now()

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Documents</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Governing documents, forms, and association records</p>
      </div>

      {loadError && <Alert tone="danger" title="Could not load your documents:">{loadError.message}</Alert>}

      {forms.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4">
            <ClipboardList className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-950">Forms</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {forms.map((f) => {
              const href = formLinks.get(f.id) ?? (f.file_url && /^https:\/\//i.test(f.file_url) ? f.file_url : null)
              return (
                <div key={f.id} className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-gray-50/60">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{f.name}</span>
                    {f.description && <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">{f.description}</div>}
                  </div>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center text-xs font-medium text-gray-600 transition hover:text-gray-950">
                      Download →
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-gray-400">Ask your manager for a copy</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {docsError ? null : docs.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <File className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No documents have been shared with you yet.</p>
          <p className="mt-1 text-xs text-gray-400">Governing documents, forms, and meeting records will appear here once your manager uploads them.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {BUCKETS.map((b) => {
            const items = grouped.get(b.key) ?? []
            // Hide an empty "Other" bucket entirely; show the three named
            // buckets always (with their own empty state) to preserve layout.
            if (b.key === 'other' && items.length === 0) return null
            return (
              <div key={b.key} className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4">
                  <b.icon className="h-5 w-5 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-950">{b.title}</h2>
                </div>
                {items.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-gray-400">No documents yet</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {items.map((d) => {
                      const href = linkByDoc.get(d.id)
                      const expires = d.expires_at ? new Date(d.expires_at).getTime() : null
                      const expiringNote = expires && expires > now ? `Expires ${date(d.expires_at)}` : null
                      return (
                        <div key={d.id} className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-gray-50/60">
                          <div className="flex min-w-0 items-center gap-3">
                            <File className="h-4 w-4 shrink-0 text-gray-400" />
                            <div className="min-w-0">
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block truncate text-sm font-medium text-gray-900 hover:text-gray-950 hover:underline"
                                >
                                  {d.file_name ?? 'Untitled document'}
                                </a>
                              ) : (
                                <span className="block truncate text-sm text-gray-700">{d.file_name ?? 'Untitled document'}</span>
                              )}
                              <div className="mt-0.5 text-xs text-gray-500">
                                {d.uploaded_at ? `Uploaded ${date(d.uploaded_at)}` : 'Upload date unknown'}
                                {expiringNote ? <span className="text-amber-600"> · {expiringNote}</span> : null}
                              </div>
                            </div>
                          </div>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-xs font-medium text-gray-600 transition hover:text-gray-950"
                            >
                              View →
                            </a>
                          ) : (
                            <span className="shrink-0 text-xs text-gray-400">File unavailable</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
