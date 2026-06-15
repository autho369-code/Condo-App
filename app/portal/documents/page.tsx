import Link from 'next/link'
import { FileText, Scale, Users, File } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'

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
  await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // RLS scopes documents to the resident's association(s), unit(s), and owner
  // record, so a plain select returns only what this owner may see.
  const { data } = await db
    .from('documents')
    .select('id, doc_type, entity_type, entity_id, file_name, file_url, uploaded_at, expires_at')
    .order('uploaded_at', { ascending: false })
  const docs = (data ?? []) as DocRow[]

  // Resolve viewable links. file_url may be a full https URL (link directly) or
  // a storage object path in a private bucket (needs a signed URL).
  const linkByDoc = new Map<string, string>()
  const pathsToSign: string[] = []
  for (const d of docs) {
    const url = d.file_url?.trim()
    if (!url) continue
    if (/^https?:\/\//i.test(url)) {
      linkByDoc.set(d.id, url)
    } else {
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

      {docs.length === 0 ? (
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
