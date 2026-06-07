import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
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

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'bg-blue-500/10 text-blue-400 ring-blue-500/20' },
    pending: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
    in_progress: { label: 'In Progress', cls: 'bg-violet-500/10 text-violet-400 ring-violet-500/20' },
    under_review: { label: 'Under Review', cls: 'bg-orange-500/10 text-orange-400 ring-orange-500/20' },
    notice_sent: { label: 'Notice Sent', cls: 'bg-pink-500/10 text-pink-400 ring-pink-500/20' },
    hearing_scheduled: { label: 'Hearing', cls: 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/20' },
    closed: { label: 'Closed', cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' },
    cured: { label: 'Cured', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
    resolved: { label: 'Resolved', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
  }
  const s = status?.toLowerCase() ?? ''
  const { label, cls } = map[s] ?? { label: status ?? '—', cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' }
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${cls}`}>{label}</span>
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-[#1E293B] last:border-b-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm text-slate-300 text-right ml-4">{value}</span>
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

  await (supabase as any)
    .from('board_comments')
    .insert({
      violation_id: violationId,
      author_id: user.id,
      author_name: authorName,
      comment: comment.trim(),
      visibility: 'board_and_manager',
    })

  revalidatePath(`/board/violations/${violationId}`)
}

export default async function BoardViolationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const boardAssocIds = me.board_association_ids ?? []
  const { id } = await params

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
        <Link href="/board/violations" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Violations
        </Link>
        <div className="rounded-xl border border-[#1E293B] p-12 text-center" style={{ backgroundColor: '#0B1121' }}>
          <AlertTriangle className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-4 text-slate-400">Violation not found or not accessible.</p>
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
      <Link href="/board/violations" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Violations
      </Link>

      {/* ── Top Header ── */}
      <div className="rounded-xl border border-[#1E293B] p-6" style={{ backgroundColor: '#0B1121' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white">{violation.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {violation.associations?.name ?? '—'}
              </span>
              {violation.units?.unit_number && (
                <span>Unit {violation.units.unit_number}</span>
              )}
              {violation.owners?.full_name && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {violation.owners.full_name}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={violation.status} />
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left Column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {violation.description && (
            <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <FileText className="h-4 w-4 text-emerald-400" />
                Description
              </h2>
              <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{violation.description}</p>
            </div>
          )}

          {/* Governing Document Reference */}
          {violation.governing_document_reference && (
            <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
              <h2 className="mb-2 text-sm font-semibold text-white">Governing Document Reference</h2>
              <p className="text-sm text-slate-400">{violation.governing_document_reference}</p>
            </div>
          )}

          {/* History Timeline */}
          <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Clock className="h-4 w-4 text-emerald-400" />
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
            <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <ImageIcon className="h-4 w-4 text-emerald-400" />
                Attachments ({attachments.length})
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {attachments.map((att: any, idx: number) => {
                  const url = typeof att === 'string' ? att : att?.url ?? att?.path ?? ''
                  const label = typeof att === 'string' ? `File ${idx + 1}` : att?.label ?? `File ${idx + 1}`
                  const isImage = url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)
                  return (
                    <div key={idx} className="rounded-lg border border-[#1E293B] overflow-hidden" style={{ backgroundColor: '#060B18' }}>
                      {isImage ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={url} alt={label} className="h-24 w-full object-cover hover:opacity-80 transition-opacity" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2">
                          <FileText className="h-4 w-4 text-slate-500" />
                          <span className="text-xs text-slate-400 truncate">{label}</span>
                        </div>
                      )}
                      {isImage && <div className="px-2 py-1 text-xs text-slate-500 truncate">{label}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notices Sent */}
          {violation.notice_sent_at && (
            <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
              <h2 className="mb-3 text-sm font-semibold text-white">Notices</h2>
              <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 px-4 py-3 border border-emerald-500/10">
                <Send className="h-5 w-5 text-emerald-400" />
                <div>
                  <div className="text-sm text-slate-300">Notice sent on {date(violation.notice_sent_at, 'long')}</div>
                  {violation.cure_deadline && (
                    <div className="text-xs text-slate-500 mt-0.5">Cure deadline: {date(violation.cure_deadline, 'long')}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Manager Notes / Communication Log */}
          {communicationLog.length > 0 && (
            <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquare className="h-4 w-4 text-emerald-400" />
                Manager Notes
              </h2>
              <div className="space-y-3">
                {communicationLog.map((entry: any, idx: number) => (
                  <div key={idx} className="rounded-lg border border-[#1E293B] p-3" style={{ backgroundColor: '#060B18' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-300">{entry.author ?? entry.by ?? 'Manager'}</span>
                      <span className="text-xs text-slate-600">{entry.date ? date(entry.date) : ''}</span>
                    </div>
                    <p className="text-sm text-slate-400">{entry.note ?? entry.text ?? entry.message ?? JSON.stringify(entry)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Owner Visible History */}
          {ownerVisibleHistory.length > 0 && (
            <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
              <h2 className="mb-3 text-sm font-semibold text-white">Owner-Visible History</h2>
              <div className="space-y-2">
                {ownerVisibleHistory.map((entry: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-slate-600 flex-shrink-0" />
                    <div>
                      <span className="text-slate-300">{entry.action ?? entry.event ?? 'Update'}</span>
                      <span className="ml-2 text-xs text-slate-600">{entry.date ? date(entry.date) : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Board Comments Section ── */}
          <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              Board Comments
            </h2>

            {/* Existing comments */}
            {boardComments.length > 0 ? (
              <div className="space-y-3 mb-6">
                {boardComments.map((comment: any) => (
                  <div key={comment.id} className="rounded-lg border border-[#1E293B] p-3" style={{ backgroundColor: '#060B18' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-emerald-400">{comment.author_name ?? 'Board Member'}</span>
                      <span className="text-xs text-slate-600">{comment.created_at ? date(comment.created_at) : ''}</span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{comment.comment}</p>
                    {comment.visibility && (
                      <div className="mt-1 text-xs text-slate-600">Visible to: {comment.visibility.replace(/_/g, ' ')}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-6 text-sm text-slate-600 italic">No board comments yet.</div>
            )}

            {/* Add comment form */}
            <form action={addBoardComment} className="space-y-3">
              <input type="hidden" name="violation_id" value={violation.id} />
              <textarea
                name="comment"
                rows={3}
                placeholder="Add an internal board comment..."
                className="w-full rounded-lg border border-[#1E293B] bg-[#060B18] px-4 py-3 text-sm text-slate-300 placeholder-slate-600 focus:border-emerald-500 focus:outline-none resize-vertical"
                required
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Visible to board members, assigned manager, and company admin</span>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                >
                  <Send className="h-4 w-4" />
                  Add Comment
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Right Column (1/3) ── */}
        <div className="space-y-6">
          {/* Hearing Info */}
          <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Calendar className="h-4 w-4 text-emerald-400" />
              Hearing Info
            </h2>
            <InfoRow label="Hearing Required" value={violation.hearing_required ? <span className="text-amber-400">Yes</span> : <span className="text-slate-500">No</span>} />
            <InfoRow label="Hearing Date" value={violation.hearing_date ? date(violation.hearing_date, 'long') : '—'} />
            <InfoRow label="Hearing Time" value={violation.hearing_at ? new Date(violation.hearing_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'} />
            <InfoRow label="Dispute Status" value={violation.dispute_status ?? '—'} />
          </div>

          {/* Fine Info */}
          <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Fine Info
            </h2>
            <InfoRow label="Fine Amount" value={violation.fine_amount ? <span className="text-amber-400 font-medium">{money(violation.fine_amount)}</span> : '—'} />
            <InfoRow label="Fine Assessed" value={violation.fine_assessed_at ? date(violation.fine_assessed_at, 'long') : '—'} />
            <InfoRow label="Cure Deadline" value={violation.cure_deadline ? date(violation.cure_deadline, 'long') : '—'} />
            <InfoRow label="Cured At" value={violation.cured_at ? date(violation.cured_at, 'long') : '—'} />
          </div>

          {/* Manager Info */}
          <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <User className="h-4 w-4 text-emerald-400" />
              Assigned Manager
            </h2>
            <div className="py-2">
              <div className="text-sm text-slate-300">{violation.profiles?.full_name ?? 'Unassigned'}</div>
              <div className="text-xs text-slate-500 mt-0.5">Created by</div>
            </div>
          </div>

          {/* Owner Info */}
          <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <User className="h-4 w-4 text-emerald-400" />
              Owner Info
            </h2>
            <InfoRow label="Name" value={violation.owners?.full_name ?? '—'} />
            <InfoRow label="Email" value={violation.owners?.email ?? '—'} />
            <InfoRow label="Phone" value={violation.owners?.phone ?? '—'} />
          </div>

          {/* Key Dates */}
          <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Clock className="h-4 w-4 text-emerald-400" />
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
  const dotColor = isSuccess ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-slate-600'
  const lineColor = isLast ? 'border-transparent' : 'border-slate-700'
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 rounded-full border-2 border-slate-700 ${dotColor}`} />
        {!isLast && <div className={`w-px flex-1 border-l ${lineColor}`} />}
      </div>
      <div className={`pb-4 ${isLast ? '' : ''}`}>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{date(dateStr, 'long')}</div>
        {detail && <div className="text-xs text-slate-400 mt-0.5">{detail}</div>}
      </div>
    </div>
  )
}
