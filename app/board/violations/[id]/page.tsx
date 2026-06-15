import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { Badge, Alert } from '@/components/ui/shell'
import { date, money } from '@/lib/utils'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Send,
  User,
  AlertTriangle,
} from 'lucide-react'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-gray-100 py-2 last:border-b-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="ml-4 text-right text-sm text-gray-900">{value}</span>
    </div>
  )
}

// Server action for adding board comments
async function addBoardComment(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const violationId = formData.get('violation_id') as string
  const comment = formData.get('comment') as string
  if (!violationId || !comment?.trim()) return

  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const authorName = profile?.full_name ?? user.email ?? 'Board Member'

  // board_comments.association_id is NOT NULL — fetch it from the violation.
  const { data: violation } = await (supabase as any)
    .from('violations')
    .select('association_id')
    .eq('id', violationId)
    .maybeSingle()

  if (!violation?.association_id) {
    redirect(`/board/violations/${violationId}?error=${encodeURIComponent('Could not resolve the violation’s association.')}`)
  }

  const { error } = await (supabase as any)
    .from('board_comments')
    .insert({
      violation_id: violationId,
      association_id: violation.association_id,
      author_id: user.id,
      author_name: authorName,
      comment: comment.trim(),
      visibility: 'board_and_manager',
    })

  if (error) {
    redirect(`/board/violations/${violationId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/board/violations/${violationId}`)
}

export default async function BoardViolationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const boardAssocIds = me.board_association_ids ?? []
  const { id } = await params
  const sp = await searchParams
  const errorMsg = typeof sp.error === 'string' ? sp.error : ''

  // Fetch violation — ensure it belongs to board's association
  const { data: violation } = await db
    .from('violations')
    .select(`*, associations!violations_association_id_fkey(name), units!violations_unit_id_fkey(unit_number), owners!violations_owner_id_fkey(full_name, email, phone), profiles!violations_created_by_fkey(full_name)`)
    .eq('id', id)
    .in('association_id', boardAssocIds)
    .maybeSingle()

  if (!violation) {
    return (
      <div className="space-y-6">
        <Link href="/board/violations" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-950">
          <ArrowLeft className="h-4 w-4" /> Back to Violations
        </Link>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Violation not found or not accessible.</p>
        </div>
      </div>
    )
  }

  // Fetch board comments
  let boardComments: any[] = []
  try {
    const { data: comments } = await db
      .from('board_comments')
      .select('*')
      .eq('violation_id', id)
      .order('created_at', { ascending: true })
    boardComments = comments ?? []
  } catch {
    // board_comments table may not exist yet
    boardComments = []
  }

  // Parse attachments
  let attachments: any[] = []
  try {
    attachments = Array.isArray(violation.attachments)
      ? violation.attachments
      : typeof violation.attachments === 'string'
        ? JSON.parse(violation.attachments)
        : []
  } catch { attachments = [] }

  // Parse communication log
  let communicationLog: any[] = []
  try {
    communicationLog = Array.isArray(violation.communication_log)
      ? violation.communication_log
      : typeof violation.communication_log === 'string'
        ? JSON.parse(violation.communication_log)
        : []
  } catch { communicationLog = [] }

  // Parse owner visible history
  let ownerVisibleHistory: any[] = []
  try {
    ownerVisibleHistory = Array.isArray(violation.owner_visible_history)
      ? violation.owner_visible_history
      : typeof violation.owner_visible_history === 'string'
        ? JSON.parse(violation.owner_visible_history)
        : []
  } catch { ownerVisibleHistory = [] }

  return (
    <div className="space-y-6">
      {/* ── Back Link ── */}
      <Link href="/board/violations" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-950">
        <ArrowLeft className="h-4 w-4" /> Back to Violations
      </Link>

      {errorMsg && (
        <Alert tone="danger" title="Could not add comment">{errorMsg}</Alert>
      )}

      {/* ── Top Header ── */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-gray-950">{violation.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                {violation.associations?.name ?? '—'}
              </span>
              {violation.units?.unit_number && (
                <span>Unit {violation.units.unit_number}</span>
              )}
              {violation.owners?.full_name && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  {violation.owners.full_name}
                </span>
              )}
            </div>
          </div>
          <Badge status={violation.status ?? '—'} />
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Left Column (2/3) ── */}
        <div className="space-y-4 lg:col-span-2">
          {/* Description */}
          {violation.description && (
            <div className={card}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-950">
                <FileText className="h-4 w-4 text-gray-400" />
                Description
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{violation.description}</p>
            </div>
          )}

          {/* Governing Document Reference */}
          {violation.governing_document_reference && (
            <div className={card}>
              <h2 className="mb-2 text-sm font-semibold text-gray-950">Governing Document Reference</h2>
              <p className="text-sm text-gray-700">{violation.governing_document_reference}</p>
            </div>
          )}

          {/* History Timeline */}
          <div className={card}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-950">
              <Clock className="h-4 w-4 text-gray-400" />
              Violation Timeline
            </h2>
            <div className="space-y-3">
              <TimelineItem
                label="Created"
                date={violation.created_at}
                detail={`By ${violation.profiles?.full_name ?? 'system'}`}
                isFirst
              />
              {violation.notice_sent_at && (
                <TimelineItem
                  label="Notice Sent"
                  date={violation.notice_sent_at}
                  detail="Violation notice delivered to owner"
                />
              )}
              {violation.hearing_date && (
                <TimelineItem
                  label="Hearing"
                  date={violation.hearing_date}
                  detail={violation.hearing_at ? `Scheduled at ${new Date(violation.hearing_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Hearing held'}
                  isWarning
                />
              )}
              {violation.fine_assessed_at && (
                <TimelineItem
                  label="Fine Assessed"
                  date={violation.fine_assessed_at}
                  detail={`$${(violation.fine_amount ?? 0).toFixed(2)}`}
                />
              )}
              {violation.cured_at && (
                <TimelineItem
                  label="Cured"
                  date={violation.cured_at}
                  detail="Violation remedied by owner"
                  isSuccess
                />
              )}
              {violation.closed_at && (
                <TimelineItem
                  label="Closed"
                  date={violation.closed_at}
                  detail={`Status: ${violation.status}`}
                  isLast
                />
              )}
              {violation.updated_at && violation.updated_at !== violation.created_at && !violation.closed_at && (
                <TimelineItem
                  label="Last Updated"
                  date={violation.updated_at}
                  detail={`Status: ${violation.status}`}
                />
              )}
            </div>
          </div>

          {/* Photos / Attachments */}
          {attachments.length > 0 && (
            <div className={card}>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-950">
                <ImageIcon className="h-4 w-4 text-gray-400" />
                Attachments ({attachments.length})
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {attachments.map((att: any, idx: number) => {
                  const url = typeof att === 'string' ? att : att?.url ?? att?.path ?? ''
                  const label = typeof att === 'string' ? `File ${idx + 1}` : att?.label ?? `File ${idx + 1}`
                  const isImage = url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)
                  return (
                    <div key={idx} className="overflow-hidden rounded-xl border border-gray-200/70 bg-gray-50/60">
                      {isImage ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={url} alt={label} className="h-24 w-full object-cover transition-opacity hover:opacity-80" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="truncate text-xs text-gray-600">{label}</span>
                        </div>
                      )}
                      {isImage && <div className="truncate px-2 py-1 text-xs text-gray-500">{label}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notices Sent */}
          {violation.notice_sent_at && (
            <div className={card}>
              <h2 className="mb-3 text-sm font-semibold text-gray-950">Notices</h2>
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3">
                <Send className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-sm text-gray-900">Notice sent on {date(violation.notice_sent_at, 'long')}</div>
                  {violation.cure_deadline && (
                    <div className="mt-0.5 text-xs text-gray-500">Cure deadline: {date(violation.cure_deadline, 'long')}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Manager Notes / Communication Log */}
          {communicationLog.length > 0 && (
            <div className={card}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-950">
                <MessageSquare className="h-4 w-4 text-gray-400" />
                Manager Notes
              </h2>
              <div className="space-y-3">
                {communicationLog.map((entry: any, idx: number) => (
                  <div key={idx} className="rounded-xl border border-gray-200/70 bg-gray-50/60 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-900">{entry.author ?? entry.by ?? 'Manager'}</span>
                      <span className="text-xs text-gray-400">{entry.date ? date(entry.date) : ''}</span>
                    </div>
                    <p className="text-sm text-gray-700">{entry.note ?? entry.text ?? entry.message ?? JSON.stringify(entry)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Owner Visible History */}
          {ownerVisibleHistory.length > 0 && (
            <div className={card}>
              <h2 className="mb-3 text-sm font-semibold text-gray-950">Owner-Visible History</h2>
              <div className="space-y-2">
                {ownerVisibleHistory.map((entry: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-gray-300" />
                    <div>
                      <span className="text-gray-900">{entry.action ?? entry.event ?? 'Update'}</span>
                      <span className="ml-2 text-xs text-gray-400">{entry.date ? date(entry.date) : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Board Comments Section ── */}
          <div className={card}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-950">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              Board Comments
            </h2>

            {/* Existing comments */}
            {boardComments.length > 0 ? (
              <div className="mb-6 space-y-3">
                {boardComments.map((comment: any) => (
                  <div key={comment.id} className="rounded-xl border border-gray-200/70 bg-gray-50/60 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-900">{comment.author_name ?? 'Board Member'}</span>
                      <span className="text-xs text-gray-400">{comment.created_at ? date(comment.created_at) : ''}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-gray-700">{comment.comment}</p>
                    {comment.visibility && (
                      <div className="mt-1 text-xs text-gray-400">Visible to: {comment.visibility.replace(/_/g, ' ')}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-6 text-sm italic text-gray-400">No board comments yet.</div>
            )}

            {/* Add comment form */}
            <form action={addBoardComment} className="space-y-3">
              <input type="hidden" name="violation_id" value={violation.id} />
              <textarea
                name="comment"
                rows={3}
                placeholder="Add an internal board comment..."
                className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-950 placeholder-gray-400 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                required
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-400">Visible to board members, assigned manager, and company admin</span>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                >
                  <Send className="h-4 w-4" />
                  Add Comment
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Right Column (1/3) ── */}
        <div className="space-y-4">
          {/* Hearing Info */}
          <div className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-950">
              <Calendar className="h-4 w-4 text-gray-400" />
              Hearing Info
            </h2>
            <InfoRow label="Hearing Required" value={violation.hearing_required ? <span className="font-medium text-amber-700">Yes</span> : <span className="text-gray-500">No</span>} />
            <InfoRow label="Hearing Date" value={violation.hearing_date ? date(violation.hearing_date, 'long') : '—'} />
            <InfoRow label="Hearing Time" value={violation.hearing_at ? new Date(violation.hearing_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'} />
            <InfoRow label="Dispute Status" value={violation.dispute_status ?? '—'} />
          </div>

          {/* Fine Info */}
          <div className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-950">
              <DollarSign className="h-4 w-4 text-gray-400" />
              Fine Info
            </h2>
            <InfoRow label="Fine Amount" value={violation.fine_amount ? <span className="font-medium text-gray-950">{money(violation.fine_amount)}</span> : '—'} />
            <InfoRow label="Fine Assessed" value={violation.fine_assessed_at ? date(violation.fine_assessed_at, 'long') : '—'} />
            <InfoRow label="Cure Deadline" value={violation.cure_deadline ? date(violation.cure_deadline, 'long') : '—'} />
            <InfoRow label="Cured At" value={violation.cured_at ? date(violation.cured_at, 'long') : '—'} />
          </div>

          {/* Manager Info */}
          <div className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-950">
              <User className="h-4 w-4 text-gray-400" />
              Assigned Manager
            </h2>
            <div className="py-2">
              <div className="text-sm text-gray-900">{violation.profiles?.full_name ?? 'Unassigned'}</div>
              <div className="mt-0.5 text-xs text-gray-500">Created by</div>
            </div>
          </div>

          {/* Owner Info */}
          <div className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-950">
              <User className="h-4 w-4 text-gray-400" />
              Owner Info
            </h2>
            <InfoRow label="Name" value={violation.owners?.full_name ?? '—'} />
            <InfoRow label="Email" value={violation.owners?.email ?? '—'} />
            <InfoRow label="Phone" value={violation.owners?.phone ?? '—'} />
          </div>

          {/* Key Dates */}
          <div className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-950">
              <Clock className="h-4 w-4 text-gray-400" />
              Key Dates
            </h2>
            <InfoRow label="Date Observed" value={date(violation.date_observed, 'long')} />
            <InfoRow label="Reported Date" value={violation.reported_date ? date(violation.reported_date, 'long') : '—'} />
            <InfoRow label="Due Date" value={violation.due_date ? date(violation.due_date, 'long') : '—'} />
            <InfoRow label="Closed At" value={violation.closed_at ? date(violation.closed_at, 'long') : '—'} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Timeline Item Component ──
function TimelineItem({
  label,
  date: dateStr,
  detail,
  isFirst,
  isLast,
  isWarning,
  isSuccess,
}: {
  label: string
  date: string
  detail?: string
  isFirst?: boolean
  isLast?: boolean
  isWarning?: boolean
  isSuccess?: boolean
}) {
  const dotColor = isSuccess ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-gray-300'
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 rounded-full border-2 border-gray-200 ${dotColor}`} />
        {!isLast && <div className="w-px flex-1 border-l border-gray-200" />}
      </div>
      <div className="pb-4">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="mt-0.5 text-xs text-gray-500">{date(dateStr, 'long')}</div>
        {detail && <div className="mt-0.5 text-xs text-gray-500">{detail}</div>}
      </div>
    </div>
  )
}
