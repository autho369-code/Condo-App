'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { submitPlatformRequest } from './actions'
import { Send, Clock, MessageSquare, RefreshCw } from 'lucide-react'

const REQUEST_TYPES = [
  { value: 'more_doors', label: 'More Doors' },
  { value: 'plan_upgrade', label: 'Plan Upgrade' },
  { value: 'plan_downgrade', label: 'Plan Downgrade' },
  { value: 'billing_review', label: 'Billing Review' },
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'data_import', label: 'Data Import' },
  { value: 'new_association', label: 'New Association Onboarding' },
  { value: 'white_glove', label: 'White-Glove Setup' },
  { value: 'urgent_issue', label: 'Urgent Platform Issue' },
] as const

const PRIORITIES = ['high', 'medium', 'low'] as const

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
const inputCls = 'mt-1 block h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 placeholder:text-gray-400 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'

function priorityBadge(p: string) {
  switch (p) {
    case 'high': return 'bg-red-50 text-red-700 ring-red-600/15'
    case 'medium': return 'bg-amber-50 text-amber-700 ring-amber-600/15'
    default: return 'bg-gray-100 text-gray-600 ring-gray-500/15'
  }
}

function statusBadge(s: string) {
  switch (s) {
    case 'open': return 'bg-blue-50 text-blue-700 ring-blue-600/15'
    case 'in_progress': return 'bg-amber-50 text-amber-700 ring-amber-600/15'
    case 'resolved': return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15'
    default: return 'bg-gray-100 text-gray-600 ring-gray-500/15'
  }
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
}

export default function PlatformRequestsPage() {
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('history')
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/company-admin/platform-requests/api')
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests ?? [])
      }
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  async function handleSubmit(formData: FormData) {
    setSubmitting(true)
    setMsg(null)
    const result = await submitPlatformRequest(formData)
    if (result.error) {
      setMsg({ type: 'error', text: result.error })
    } else {
      setMsg({ type: 'success', text: 'Request submitted successfully. The platform team will respond shortly.' })
      formRef.current?.reset()
      fetchRequests()
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Platform Requests</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Submit and track requests to the platform operator
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex w-fit gap-1 rounded-xl border border-gray-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <button
          onClick={() => { setActiveTab('submit'); setMsg(null) }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'submit'
              ? 'bg-gray-950 text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Send className="mr-1.5 inline h-4 w-4" />
          Submit Request
        </button>
        <button
          onClick={() => { setActiveTab('history'); fetchRequests() }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-gray-950 text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Clock className="mr-1.5 inline h-4 w-4" />
          Request History
        </button>
      </div>

      {/* Submit Request Tab */}
      {activeTab === 'submit' && (
        <div className={`${card} p-6`}>
          <h2 className="mb-6 text-sm font-semibold text-gray-950">New Platform Request</h2>

          {msg && (
            <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              msg.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}>
              {msg.text}
            </div>
          )}

          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Request Type</span>
                <select name="request_type" required className={inputCls}>
                  <option value="">Select type...</option>
                  {REQUEST_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Priority</span>
                <select name="priority" required defaultValue="medium" className={inputCls}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Subject</span>
              <input
                name="subject"
                required
                placeholder="Brief summary of your request"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Description</span>
              <textarea
                name="description"
                required
                rows={5}
                placeholder="Provide detailed information about your request..."
                className={`${inputCls} h-auto resize-y py-2`}
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      )}

      {/* Request History Tab */}
      {activeTab === 'history' && (
        <div className={card}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">Request History</h2>
            <button
              onClick={fetchRequests}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <Th>Type</Th>
                  <Th>Subject</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Response</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-sm text-gray-500">
                      <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-gray-300" />
                      Loading requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <MessageSquare className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                      <div className="text-sm font-semibold text-gray-900">No platform requests yet.</div>
                      <div className="mt-1 text-sm text-gray-500">
                        Use the Submit Request tab to send your first request.
                      </div>
                    </td>
                  </tr>
                ) : (
                  requests.map((r: any) => {
                    const typeLabel = REQUEST_TYPES.find((t) => t.value === r.request_type)?.label ?? r.request_type?.replace(/_/g, ' ') ?? '—'
                    return (
                      <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                        <Td className="font-medium text-gray-900">{typeLabel}</Td>
                        <Td className="max-w-xs truncate text-gray-900">{r.title ?? '—'}</Td>
                        <Td>
                          <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset ${priorityBadge(r.priority)}`}>
                            {(r.priority ?? '—').charAt(0).toUpperCase() + (r.priority ?? '').slice(1)}
                          </span>
                        </Td>
                        <Td>
                          <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium capitalize ring-1 ring-inset ${statusBadge(r.status)}`}>
                            {(r.status ?? 'unknown').replace(/_/g, ' ')}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap tabular-nums text-gray-700">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </Td>
                        <Td className="max-w-xs truncate text-gray-500">{r.platform_response ?? 'Awaiting response'}</Td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
