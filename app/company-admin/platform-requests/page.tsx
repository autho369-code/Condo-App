'use client'

import { Button } from '@/components/ui/button'
import { SegmentedButtons } from '@/components/ui/segmented'
import { useCallback, useEffect, useRef, useState } from 'react'
import { submitPlatformRequest } from './actions'
import { Send, Clock, MessageSquare, RefreshCw } from 'lucide-react'
import { Alert } from '@/components/ui/shell'

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

const card = 'rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
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
  return <th className="whitespace-nowrap px-4 py-3 text-left text-[12.5px] font-medium text-gray-500">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
}

export default function PlatformRequestsPage() {
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('history')
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/company-admin/platform-requests/api')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Never show a failed load as "No platform requests yet".
        setLoadError(data?.error ?? `Could not load platform requests (HTTP ${res.status}).`)
        setRequests([])
      } else {
        setRequests(data.requests ?? [])
      }
    } catch {
      setLoadError('Could not reach the server to load platform requests.')
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
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Platform Requests</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Submit and track requests to the platform operator
        </p>
      </div>

      {/* Tab bar */}
      <SegmentedButtons label="Platform requests" value={activeTab}
        items={[{ id: 'submit', label: 'Submit Request', icon: Send }, { id: 'history', label: 'Request History', icon: Clock }]}
        onChange={(id) => {
          if (id === 'submit') { setActiveTab('submit'); setMsg(null) }
          else { setActiveTab('history'); fetchRequests() }
        }} />

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
                <span className="text-[13px] font-medium text-gray-500">Request Type</span>
                <select name="request_type" required className={inputCls}>
                  <option value="">Select type...</option>
                  {REQUEST_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[13px] font-medium text-gray-500">Priority</span>
                <select name="priority" required defaultValue="medium" className={inputCls}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-[13px] font-medium text-gray-500">Subject</span>
              <input
                name="subject"
                required
                placeholder="Brief summary of your request"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-gray-500">Description</span>
              <textarea
                name="description"
                required
                rows={5}
                placeholder="Provide detailed information about your request..."
                className={`${inputCls} h-auto resize-y py-2`}
              />
            </label>
            <Button type="submit" disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
        </div>
      )}

      {/* Request History Tab */}
      {activeTab === 'history' && (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Request History</h2>
            <Button type="button" variant="ghost" size="sm" onClick={fetchRequests}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
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
                ) : loadError ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6">
                      <Alert title="Could not load requests">{loadError}</Alert>
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
                      <tr key={r.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
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
