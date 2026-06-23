import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { castApproval } from './actions'
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  ClipboardCheck,
  AlertTriangle,
  PenLine,
  Clock,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const SCHEME_LABEL: Record<string, string> = {
  any_one_approver: 'Any one approver',
  majority_approval_required: 'Majority approval',
  unanimous_approval_required: 'Unanimous approval',
  percentage_required: 'Percentage required',
}

const TYPE_LABEL: Record<string, string> = {
  expense: 'Expense',
  contract: 'Contract',
  budget: 'Budget',
  policy: 'Policy',
  architectural: 'Architectural',
}

function statusTone(status?: string | null): Tone {
  switch (status) {
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'cancelled':
      return 'neutral'
    default:
      return 'warning'
  }
}

function decisionTone(decision?: string | null): Tone {
  switch (decision) {
    case 'approve':
      return 'success'
    case 'reject':
      return 'danger'
    default:
      return 'neutral'
  }
}

function money(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount))
}

function pretty(value: string | null | undefined, map: Record<string, string>): string {
  if (!value) return '—'
  return map[value] ?? value.replace(/_/g, ' ')
}

interface ApprovalRequest {
  id: string
  association_id: string | null
  request_type: string | null
  title: string | null
  description: string | null
  amount: number | null
  due_date: string | null
  status: string | null
  voting_scheme: string | null
  required_votes: number | null
  votes_for: number | null
  votes_against: number | null
  votes_abstain: number | null
  signatures_required: boolean | null
  board_member_ids: string[] | null
  percentage_required: number | null
  requested_by_name: string | null
  requested_at: string | null
  decision_at: string | null
  associations?: { name: string } | null
}

interface Decision {
  id: string
  approval_request_id: string
  decided_by: string | null
  decision: string
  signature_name: string | null
  comment: string | null
  decided_at: string
  board_members?: { full_name: string | null } | null
}

export default async function BoardApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const boardAssocIds = me.board_association_ids ?? []
  const params = await searchParams
  const errorMsg = typeof params.error === 'string' ? params.error : null
  const signed = params.signed === '1'

  if (boardAssocIds.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyCard
          icon={AlertTriangle}
          title="No associations assigned to your board membership."
          subtitle="Contact your platform administrator for access."
        />
      </div>
    )
  }

  const { data: requestsData } = await db
    .from('approval_requests')
    .select(
      'id, association_id, request_type, title, description, amount, due_date, status, voting_scheme, required_votes, votes_for, votes_against, votes_abstain, signatures_required, board_member_ids, percentage_required, requested_by_name, requested_at, decision_at, associations!approval_requests_association_id_fkey(name)',
    )
    .in('association_id', boardAssocIds)
    .is('archived_at', null)
    .order('requested_at', { ascending: false })

  const requests = (requestsData ?? []) as ApprovalRequest[]

  // Pull all decisions for these requests in one query.
  const requestIds = requests.map((r) => r.id)
  let decisionsByRequest = new Map<string, Decision[]>()
  let myDecisionByRequest = new Map<string, Decision>()
  if (requestIds.length > 0) {
    const { data: decisionsData } = await db
      .from('approval_decisions')
      .select('id, approval_request_id, decided_by, decision, signature_name, comment, decided_at, board_members(full_name)')
      .in('approval_request_id', requestIds)
      .order('decided_at', { ascending: true })
    for (const d of (decisionsData ?? []) as Decision[]) {
      const list = decisionsByRequest.get(d.approval_request_id) ?? []
      list.push(d)
      decisionsByRequest.set(d.approval_request_id, list)
      if (d.decided_by === me.auth_user_id) myDecisionByRequest.set(d.approval_request_id, d)
    }
  }

  const pending = requests.filter((r) => r.status === 'pending')
  const decided = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="space-y-6">
      <Header />

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {signed && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Your sign-off was recorded.</span>
        </div>
      )}

      {/* Pending */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Awaiting your sign-off</h2>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/15">
            {pending.length}
          </span>
        </div>
        {pending.length === 0 ? (
          <EmptyCard icon={ClipboardCheck} title="No approvals are pending." subtitle="New requests from your manager will appear here." />
        ) : (
          pending.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              decisions={decisionsByRequest.get(r.id) ?? []}
              myDecision={myDecisionByRequest.get(r.id)}
              showForm
            />
          ))
        )}
      </section>

      {/* Decided */}
      {decided.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Decided</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-inset ring-gray-500/15">
              {decided.length}
            </span>
          </div>
          {decided.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              decisions={decisionsByRequest.get(r.id) ?? []}
              myDecision={myDecisionByRequest.get(r.id)}
            />
          ))}
        </section>
      )}
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Approvals</h1>
      <p className="mt-1.5 text-sm leading-6 text-gray-500">
        Review and digitally sign off on requests submitted by your management team.
      </p>
    </div>
  )
}

function EmptyCard({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <Icon className="mx-auto h-10 w-10 text-gray-300" />
      <p className="mt-3 text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
    </div>
  )
}

function eligibleCount(r: ApprovalRequest): number | null {
  if (r.board_member_ids && r.board_member_ids.length > 0) return r.board_member_ids.length
  return null
}

function RequestCard({
  request: r,
  decisions,
  myDecision,
  showForm,
}: {
  request: ApprovalRequest
  decisions: Decision[]
  myDecision?: Decision
  showForm?: boolean
}) {
  const eligible = eligibleCount(r)
  const elig = eligible ?? '—'

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-gray-950">{r.title ?? 'Untitled request'}</h3>
            <StatusChip tone={statusTone(r.status)}>{r.status ?? 'pending'}</StatusChip>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>{pretty(r.request_type, TYPE_LABEL)}</span>
            {r.associations?.name && <span>· {r.associations.name}</span>}
            <span>· Requested {date(r.requested_at)}</span>
            {r.requested_by_name && <span>by {r.requested_by_name}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums text-gray-950">{money(r.amount)}</div>
          {r.due_date && <div className="text-xs text-gray-500">Due {date(r.due_date)}</div>}
        </div>
      </div>

      {r.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600">{r.description}</p>}

      {/* Voting summary */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-gray-50/70 px-4 py-2.5 text-xs">
        <span className="font-medium text-gray-500">{pretty(r.voting_scheme, SCHEME_LABEL)}</span>
        {r.voting_scheme === 'percentage_required' && r.percentage_required != null && (
          <span className="text-gray-500">· {r.percentage_required}% needed</span>
        )}
        <span className="ml-auto flex items-center gap-3 tabular-nums">
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {r.votes_for ?? 0} for
          </span>
          <span className="inline-flex items-center gap-1 text-red-700">
            <XCircle className="h-3.5 w-3.5" /> {r.votes_against ?? 0} against
          </span>
          <span className="inline-flex items-center gap-1 text-gray-500">
            <MinusCircle className="h-3.5 w-3.5" /> {r.votes_abstain ?? 0} abstain
          </span>
          <span className="text-gray-400">of {elig} eligible</span>
        </span>
      </div>

      {/* Decisions so far */}
      {decisions.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Sign-offs</div>
          <ul className="mt-2 divide-y divide-gray-100">
            {decisions.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-medium text-gray-900">{d.board_members?.full_name ?? 'Board member'}</span>
                <StatusChip tone={decisionTone(d.decision)}>{d.decision}</StatusChip>
                {d.signature_name && (
                  <span className="inline-flex items-center gap-1 text-xs italic text-gray-500">
                    <PenLine className="h-3 w-3" /> {d.signature_name}
                  </span>
                )}
                <span className="ml-auto text-xs tabular-nums text-gray-400">{date(d.decided_at)}</span>
                {d.comment && <p className="w-full text-xs text-gray-500">{d.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sign-off form */}
      {showForm && <SignOffForm request={r} myDecision={myDecision} />}
    </div>
  )
}

function SignOffForm({ request: r, myDecision }: { request: ApprovalRequest; myDecision?: Decision }) {
  const sigRequired = !!r.signatures_required
  return (
    <form action={castApproval} className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50/40 p-4">
      <input type="hidden" name="request_id" value={r.id} />

      {myDecision && (
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          You previously chose <span className="font-semibold capitalize">{myDecision.decision}</span> on {date(myDecision.decided_at)}.
          Submitting again will update your sign-off.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { value: 'approve', label: 'Approve', cls: 'peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700' },
          { value: 'reject', label: 'Reject', cls: 'peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700' },
          { value: 'abstain', label: 'Abstain', cls: 'peer-checked:border-gray-400 peer-checked:bg-gray-100 peer-checked:text-gray-800' },
        ].map((opt) => (
          <label key={opt.value} className="cursor-pointer">
            <input
              type="radio"
              name="decision"
              value={opt.value}
              defaultChecked={myDecision?.decision === opt.value}
              required
              className="peer sr-only"
            />
            <span
              className={`inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 transition ${opt.cls}`}
            >
              {opt.label}
            </span>
          </label>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Type your full name to sign{sigRequired ? ' *' : ' (optional)'}
        </label>
        <input
          type="text"
          name="signature"
          required={sigRequired}
          defaultValue={myDecision?.signature_name ?? ''}
          placeholder="e.g. Jane Doe"
          className="h-10 w-full max-w-sm rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Comment (optional)</label>
        <textarea
          name="comment"
          rows={2}
          defaultValue={myDecision?.comment ?? ''}
          placeholder="Add a note for the record…"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        />
      </div>

      <button
        type="submit"
        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gray-950 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800"
      >
        <PenLine className="h-4 w-4" />
        {myDecision ? 'Update sign-off' : 'Submit sign-off'}
      </button>
    </form>
  )
}
