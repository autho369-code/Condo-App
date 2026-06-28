import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { ArcMessageThread, type ArcMessage } from '@/components/architectural/message-thread'
import { postArchitecturalMessage } from '@/lib/rpcs/architectural'
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

export default async function BoardArchitecturalDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const me = await requireBoard()
  const { id } = await params
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  const { data: req } = await db
    .from('architectural_requests')
    .select('id, title, description, category, status, decision_notes, created_at, association_id, units(unit_number), owners(full_name)')
    .eq('id', id)
    .in('association_id', ids)
    .maybeSingle()

  if (!req) return notFound()

  const { data: messages } = await db
    .from('architectural_request_messages')
    .select('id, author_name, author_role, body, created_at')
    .eq('request_id', id)
    .order('created_at', { ascending: true })

  const postAction = postArchitecturalMessage.bind(null, id, 'board', '/board/architectural-reviews')

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/board/architectural-reviews" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-950">
        <ArrowLeft className="h-4 w-4" /> Back to architectural reviews
      </Link>

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
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Decision notes</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{req.decision_notes}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Discussion</h2>
        <ArcMessageThread messages={(messages ?? []) as ArcMessage[]} postAction={postAction as any} placeholder="Add the board's comments for management and the homeowner…" />
      </div>
    </div>
  )
}
