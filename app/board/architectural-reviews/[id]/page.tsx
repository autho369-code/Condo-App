import Link from 'next/link'
import { Alert } from '@/components/ui/shell'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { ArcMessageThread, type ArcMessage } from '@/components/architectural/message-thread'
import { postArchitecturalMessage, decideArchitecturalRequest } from '@/lib/rpcs/architectural'
import { Button } from '@/components/ui/button'
import { ArcAttachments, type ArcAttachment } from '@/components/architectural/attachments'
import { date } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, Tone> = {
  submitted: 'info', under_review: 'warning', more_info: 'warning',
  approved: 'success', denied: 'danger', withdrawn: 'neutral',
}
const CATEGORY_LABEL: Record<string, string> = {
  exterior_paint: 'Exterior paint', fence: 'Fence', landscaping: 'Landscaping',
  roof: 'Roof', addition: 'Addition', deck_patio: 'Deck / patio',
  windows_doors: 'Windows / doors', solar: 'Solar', pool: 'Pool', other: 'Other',
}
const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const OPEN_STATUSES = ['submitted', 'under_review', 'more_info']
const DECIDED_MESSAGE: Record<string, string> = {
  approved: 'Request approved. The homeowner has been emailed and the decision is in the discussion.',
  denied: 'Request denied. The homeowner has been emailed with your reason.',
  more_info: 'More information requested. The homeowner has been emailed.',
  under_review: 'Marked under review.',
}

export default async function BoardArchitecturalDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; decided?: string }>
}) {
  const me = await requireBoard()
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  const { data: req, error: reqError } = await db
    .from('architectural_requests')
    .select('id, title, description, category, status, decision_notes, decided_at, created_at, association_id, owner_id, attachments, units(unit_number), owners(full_name)')
    .eq('id', id)
    .in('association_id', ids)
    .maybeSingle()

  // A failed read is not a missing request: say so instead of a 404.
  if (reqError) {
    return (
      <div className="max-w-3xl space-y-6">
        <Link href="/board/architectural-reviews" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-950">
          <ArrowLeft className="h-4 w-4" /> Back to architectural reviews
        </Link>
        <Alert tone="danger" title="This request could not be loaded">{reqError.message}</Alert>
      </div>
    )
  }
  if (!req) return notFound()

  const { data: messages, error: messagesError } = await db
    .from('architectural_request_messages')
    .select('id, author_name, author_role, body, created_at')
    .eq('request_id', id)
    .order('created_at', { ascending: true })

  const postAction = postArchitecturalMessage.bind(null, id, 'board', '/board/architectural-reviews')
  const decideAction = decideArchitecturalRequest.bind(null, id, '/board/architectural-reviews')
  const isOpen = OPEN_STATUSES.includes(req.status)
  // A board member who filed the request must not decide it.
  const isOwnRequest = !!me.owner_id && req.owner_id === me.owner_id

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/board/architectural-reviews" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-950">
        <ArrowLeft className="h-4 w-4" /> Back to architectural reviews
      </Link>
      {messagesError && <Alert tone="danger" title="The discussion could not be loaded">{messagesError.message}</Alert>}
      {sp.error && <Alert tone="danger" title="That did not go through.">{sp.error}</Alert>}
      {sp.decided && DECIDED_MESSAGE[sp.decided] && <Alert tone="success" title="Decision recorded">{DECIDED_MESSAGE[sp.decided]}</Alert>}

      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-gray-950">{req.title}</h1>
            <div className="mt-1 text-sm text-gray-500">
              {CATEGORY_LABEL[req.category] ?? 'Other'} — Unit {req.units?.unit_number ?? '—'} · {req.owners?.full_name ?? ''} · {date(req.created_at)}
            </div>
          </div>
          <StatusChip tone={STATUS_TONE[req.status] ?? 'neutral'}>{label(req.status)}</StatusChip>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{req.description}</p>
        {req.decision_notes && (
          <div className="mt-4 rounded-xl border border-gray-200/70 bg-gray-50 p-3.5">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Decision notes{req.decided_at ? ` · ${date(req.decided_at)}` : ''}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{req.decision_notes}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Documents</h2>
        <ArcAttachments
          requestId={id}
          basePath="/board/architectural-reviews"
          attachments={(req.attachments ?? []) as ArcAttachment[]}
          canUpload={false}
          canRemove={false}
        />
      </div>

      {isOpen && (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="text-sm font-semibold text-gray-900">Board decision</h2>
          {isOwnRequest ? (
            <p className="mt-2 text-sm text-gray-500">
              You filed this request, so another board member or management must decide it.
            </p>
          ) : (
            <form action={decideAction as any} className="mt-3 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Notes for the homeowner</span>
                <textarea
                  name="decision_notes"
                  rows={3}
                  maxLength={4000}
                  placeholder="Conditions of approval, the reason for a denial, or what information is missing…"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
                <span className="mt-1 block text-xs text-gray-500">Required to deny or to ask for more information. The homeowner is emailed.</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="decision" value="approve" size="sm">Approve</Button>
                <Button type="submit" name="decision" value="deny" size="sm" variant="secondary">Deny</Button>
                <Button type="submit" name="decision" value="more_info" size="sm" variant="secondary">Request more info</Button>
                {req.status === 'submitted' && (
                  <Button type="submit" name="decision" value="review" size="sm" variant="ghost">Mark under review</Button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Discussion</h2>
        <ArcMessageThread messages={(messages ?? []) as ArcMessage[]} postAction={postAction as any} placeholder="Add the board's comments for management and the homeowner…" />
      </div>
    </div>
  )
}
