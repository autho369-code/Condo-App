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

function priorityBadge(p: string) {
  switch (p) {
    case 'high': return 'bg-red-500/10 text-red-400 ring-red-500/20'
    case 'medium': return 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
    case 'low': return 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
    default: return 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
  }
}

function statusBadge(s: string) {
  switch (s) {
    case 'open': return 'bg-blue-500/10 text-blue-400 ring-blue-500/20'
    case 'in_progress': return 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
    case 'resolved': return 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
    case 'closed': return 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
    default: return 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
  }
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{children}</th>
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
        <h1 className="text-2xl font-bold text-white">Platform Requests</h1>
        <p className="mt-1 text-sm text-slate-400">
          Submit and track requests to the platform operator
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-[#1E293B] p-1 w-fit" style={{ backgroundColor: '#0B1121' }}>
        <button
          onClick={() => { setActiveTab('submit'); setMsg(null) }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'submit'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Send className="inline h-4 w-4 mr-1.5" />
          Submit Request
        </button>
        <button
          onClick={() => { setActiveTab('history'); fetchRequests() }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="inline h-4 w-4 mr-1.5" />
          Request History
        </button>
      </div>

      {/* Submit Request Tab */}
      {activeTab === 'submit' && (
        <div className="rounded-xl border border-[#1E293B] p-6" style={{ backgroundColor: '#0B1121' }}>
          <h2 className="mb-6 text-sm font-semibold text-white">New Platform Request</h2>

          {msg && (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${
              msg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {msg.text}
            </div>
          )}

          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium uppercase text-slate-500">Request Type</span>
                <select
                  name="request_type"
                  required
                  className="mt-1 block h-10 w-full rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select type...</option>
                  {REQUEST_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-slate-500">Priority</span>
                <select
                  name="priority"
                  required
                  defaultValue="medium"
                  className="mt-1 block h-10 w-full rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium uppercase text-slate-500">Subject</span>
              <input
                name="subject"
                required
                placeholder="Brief summary of your request"
                className="mt-1 block h-10 w-full rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase text-slate-500">Description</span>
              <textarea
                name="description"
                required
                rows={5}
                placeholder="Provide detailed information about your request..."
                className="mt-1 block w-full rounded-lg border border-[#1E293B] bg-[#060B18] px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      )}

      {/* Request History Tab */}
      {activeTab === 'history' && (
        <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
          <div className="flex items-center justify-between border-b border-[#1E293B] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Request History</h2>
            <button
              onClick={fetchRequests}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  <Th>Type</Th>
                  <Th>Subject</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Response</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                      <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-slate-600" />
                      Loading requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <MessageSquare className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                      <div className="text-sm text-slate-400">No platform requests yet.</div>
                      <div className="mt-1 text-xs text-slate-600">
                        Use the Submit Request tab to send your first request.
                      </div>
                    </td>
                  </tr>
                ) : (
                  requests.map((r: any) => {
                    const typeLabel = REQUEST_TYPES.find((t) => t.value === r.request_type)?.label ?? r.request_type?.replace(/_/g, ' ') ?? '—'
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <Td className="font-medium text-slate-200">{typeLabel}</Td>
                        <Td className="max-w-xs truncate text-slate-200">{r.subject ?? '—'}</Td>
                        <Td>
                          <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${priorityBadge(r.priority)}`}>
                            {(r.priority ?? '—').charAt(0).toUpperCase() + (r.priority ?? '').slice(1)}
                          </span>
                        </Td>
                        <Td>
                          <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${statusBadge(r.status)}`}>
                            {(r.status ?? 'unknown').replace(/_/g, ' ')}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-slate-400">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </Td>
                        <Td className="max-w-xs truncate text-slate-400">{r.response ?? 'Awaiting response'}</Td>
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
