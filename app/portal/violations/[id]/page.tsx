import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isScopedStoragePath } from '@/lib/security/storage-paths'
import { requireOwner } from '@/lib/auth/me'
import { notFound, redirect } from 'next/navigation'
import { Alert, Badge, Surface } from '@/components/ui/shell'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { requestViolationHearing } from '@/lib/rpcs/violations'
import { money, date } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, Image as ImageIcon } from 'lucide-react'
import { ViolationLettersList } from '@/components/violations/letters-list'
import { signLetterLinks, VIOLATION_LETTER_COLUMNS, type ViolationLetterRow } from '@/lib/violations/letter-links'

export const dynamic = 'force-dynamic'

// Violation photos live in the private records bucket (same as the staff page).
const ATTACH_BUCKET = 'association-documents'

export default async function OwnerViolationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ hearing_requested?: string; error?: string }>
}) {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  const { id } = await params
  const sp = await searchParams

  const { data: v } = await db.from('violations')
    .select('id, title, description, violation_type, status, date_observed, hearing_date, hearing_at, hearing_required, hearing_requested_at, hearing_request_note, fine_amount, fines_total, fine_assessed_at, notice_sent_at, board_decision, attachments, governing_document_reference, units!inner(unit_number)')
    .eq('id', id).in('owner_id', me.owner_ids).maybeSingle()

  if (!v) return notFound()

  // Attachments are stored as [{ name, path, size, ... }] (legacy entries may
  // be plain strings). Storage paths are signed only after the RLS-scoped read
  // above proved this violation is the owner's, and only when the path is
  // scoped to this violation's folder.
  const rawAttachments: any[] = Array.isArray(v.attachments) ? v.attachments : []
  const atts = rawAttachments
    .map((a: any, idx: number) => {
      if (typeof a === 'string') return { name: `File ${idx + 1}`, path: a }
      const path = typeof a?.path === 'string' ? a.path : typeof a?.url === 'string' ? a.url : ''
      return path ? { name: String(a?.name ?? a?.label ?? `File ${idx + 1}`), path } : null
    })
    .filter(Boolean) as Array<{ name: string; path: string }>
  const linkByPath = new Map<string, string>()
  const pathsToSign = atts.map((a) => a.path).filter((path) => isScopedStoragePath(path, 'violations', v.id))
  if (pathsToSign.length > 0) {
    try {
      const svc = createServiceClient() as any
      const { data: signed } = await svc.storage.from(ATTACH_BUCKET).createSignedUrls(pathsToSign, 3600)
      for (const s of signed ?? []) if (s?.path && s?.signedUrl) linkByPath.set(s.path, s.signedUrl)
    } catch {}
  }
  const hrefFor = (path: string) => (/^https:\/\//i.test(path) ? path : linkByPath.get(path) ?? null)
  // RLS returns only this owner's letters that were delivered to the portal.
  const { data: letterRows } = await db.from('violation_letters')
    .select(VIOLATION_LETTER_COLUMNS).eq('violation_id', v.id).order('created_at', { ascending: false })
  const letters = (letterRows ?? []) as ViolationLetterRow[]
  const letterLinks = await signLetterLinks(letters)
  const fines = Number(v.fines_total ?? 0) > 0 ? Number(v.fines_total) : Number(v.fine_amount ?? 0)

  async function requestHearing(formData: FormData) {
    'use server'
    const result = await requestViolationHearing(id, String(formData.get('reason') ?? ''))
    if (result.error) redirect(`/portal/violations/${id}?error=${encodeURIComponent(result.error)}`)
    redirect(`/portal/violations/${id}?hearing_requested=1`)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/portal/violations" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-950"><ArrowLeft className="h-4 w-4" /> Back to violations</Link>

      {sp.hearing_requested === '1' && <Alert tone="success">Hearing request submitted to association management.</Alert>}
      {sp.error && <Alert tone="danger" title="Could not request a hearing:">{sp.error}</Alert>}

      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-gray-950">{v.title}</h1>
            <div className="mt-1 text-sm capitalize text-gray-500">{v.violation_type?.replace('_',' ')} — Unit {v.units?.unit_number}</div>
          </div>
          <Badge status={v.status} />
        </div>

        {v.description && <p className="text-sm text-gray-600 mb-4">{v.description}</p>}

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span className="text-gray-500">Date Observed:</span> <span className="text-gray-900">{date(v.date_observed)}</span></div>
          <div><span className="text-gray-500">Fine:</span> <span className="text-gray-900 font-medium">{fines > 0 ? money(fines) : 'None'}</span></div>
          <div><span className="text-gray-500">Hearing Date:</span> <span className="text-gray-900">{v.hearing_date ? date(v.hearing_date) : v.hearing_at ? date(v.hearing_at) : 'Not scheduled'}</span></div>
          <div><span className="text-gray-500">Notice Sent:</span> <span className="text-gray-900">{v.notice_sent_at ? date(v.notice_sent_at) : '—'}</span></div>
          <div><span className="text-gray-500">Board Decision:</span> <span className="text-gray-900 capitalize">{v.board_decision ?? 'Pending'}</span></div>
          {v.governing_document_reference && <div className="col-span-2"><span className="text-gray-500">Governing Doc:</span> <span className="text-gray-900">{v.governing_document_reference}</span></div>}
        </div>

        {atts.length > 0 && (
          <div className="border-t border-gray-100 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Photos</h3>
            <div className="flex gap-3 flex-wrap">
              {atts.map((a, i) => {
                const href = hrefFor(a.path)
                const tile = (
                  <>
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                    <span className="mt-1 w-full truncate px-2 text-center text-[12.5px] text-gray-500">{href ? a.name : 'Unavailable'}</span>
                  </>
                )
                return href ? (
                  <a key={i} href={href} target="_blank" rel="noopener noreferrer" title={a.name} className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-gray-200/70 bg-gray-50 transition hover:border-gray-300">
                    {tile}
                  </a>
                ) : (
                  <div key={i} title={a.name} className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-gray-200/70 bg-gray-50">
                    {tile}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <Surface padded={false}>
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-950">Letters</h2>
          <p className="mt-0.5 text-sm text-gray-500">Notices the association has sent you about this violation.</p>
        </div>
        <ViolationLettersList letters={letters} links={letterLinks} />
      </Surface>

      <Surface>
        {v.hearing_requested_at ? (
          <div>
            <h2 className="text-base font-semibold text-gray-950">Hearing requested</h2>
            <p className="mt-1 text-sm text-gray-500">Submitted {date(v.hearing_requested_at)}. Management will post the date and location after scheduling.</p>
            {v.hearing_request_note && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">{v.hearing_request_note}</p>}
          </div>
        ) : v.hearing_date || v.hearing_at ? (
          <div><h2 className="text-base font-semibold text-gray-950">Hearing scheduled</h2><p className="mt-1 text-sm text-gray-500">Your hearing is scheduled for {date(v.hearing_date ?? v.hearing_at)}.</p></div>
        ) : v.status === 'closed' || v.status === 'cured' ? (
          <p className="text-sm text-gray-500">This violation is closed, so a hearing can no longer be requested.</p>
        ) : (
          <form action={requestHearing} className="space-y-4">
            <div><h2 className="text-base font-semibold text-gray-950">Request a hearing</h2><p className="mt-1 text-sm text-gray-500">Explain why you are contesting the violation or what you want the board to review.</p></div>
            <Textarea name="reason" required minLength={10} maxLength={1000} rows={4} placeholder="Describe the facts, dates, or governing-document issue you want reviewed." />
            <Button type="submit">Submit hearing request</Button>
          </form>
        )}
      </Surface>
    </div>
  )
}
