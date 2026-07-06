import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePlatformOperator } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { ShieldCheck, UserX, KeyRound, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

const SENSITIVE_ACTIONS = [
  'password_set', 'password_reset_sent', 'password_reset_forced',
  'user_disabled', 'user_enabled', 'user_deleted', 'role_changed',
  'company_suspended', 'company_reactivated', 'company_archived',
  'invitation_regenerated', 'plan_changed',
]

export default async function SecurityCenterPage() {
  await requirePlatformOperator()
  const supabase = await createClient()
  const db = supabase as any
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { data: sensitiveEvents },
    { data: impersonations },
    { data: portfolios },
    { count: disabledUsers },
    { data: apiKeys },
  ] = await Promise.all([
    db.from('audit_logs').select('id, action, actor_email, entity_type, entity_id, ip_address, created_at').in('action', SENSITIVE_ACTIONS).gte('created_at', d30).order('created_at', { ascending: false }).limit(50),
    db.from('platform_impersonation_log').select('id, operator_email, impersonated_email, reason, started_at, ended_at, ip_address').order('started_at', { ascending: false }).limit(25),
    db.from('portfolios').select('id, company_name, require_mfa_for_staff, require_mfa_for_admins, password_min_length, session_timeout_minutes').is('archived_at', null),
    db.from('profiles').select('id', { count: 'exact', head: true }).not('disabled_at', 'is', null),
    db.from('api_keys').select('id, name, prefix, scopes, last_used_at, expires_at, revoked_at, portfolios(company_name)').order('created_at', { ascending: false }).limit(50),
  ])

  const today = new Date().toISOString()
  const mfaStaff = (portfolios ?? []).filter((p: any) => p.require_mfa_for_staff).length
  const mfaAdmins = (portfolios ?? []).filter((p: any) => p.require_mfa_for_admins).length
  const activeKeys = (apiKeys ?? []).filter((k: any) => !k.revoked_at && (!k.expires_at || k.expires_at > today))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Security Center</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Sensitive account activity, impersonation history, MFA posture, and API keys across the platform
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Sensitive Events (30d)', value: (sensitiveEvents ?? []).length, icon: ShieldCheck, warn: false },
          { label: 'Disabled Users', value: disabledUsers ?? 0, icon: UserX, warn: false },
          { label: 'MFA Required (staff/admins)', value: `${mfaStaff} / ${mfaAdmins} of ${(portfolios ?? []).length}`, icon: ShieldCheck, warn: false },
          { label: 'Active API Keys', value: activeKeys.length, icon: KeyRound, warn: false },
        ].map((item: any) => {
          const Icon = item.icon
          return (
            <div key={item.label} className={`${card} px-4 py-3.5`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{item.label}</div>
                  <div className="mt-1.5 truncate text-xl font-semibold tabular-nums text-gray-950">{item.value}</div>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Impersonation log ─────────────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Impersonation History</h2>
          <p className="mt-0.5 text-xs text-gray-500">Every operator support session, permanently logged</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Operator</th>
                <th className="px-5 py-2.5 text-left font-medium">Impersonated</th>
                <th className="px-5 py-2.5 text-left font-medium">Reason</th>
                <th className="px-5 py-2.5 text-left font-medium">Started</th>
                <th className="px-5 py-2.5 text-left font-medium">Ended</th>
                <th className="px-5 py-2.5 text-left font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {(impersonations ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">No impersonation sessions recorded.</td></tr>
              ) : (
                (impersonations ?? []).map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900">{s.operator_email}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{s.impersonated_email}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-[13px] text-gray-700">{s.reason ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(s.started_at)}</td>
                    <td className="px-5 py-3">
                      {s.ended_at
                        ? <span className="text-[13px] tabular-nums text-gray-700">{date(s.ended_at)}</span>
                        : <StatusChip tone="warning">Active</StatusChip>}
                    </td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-500">{s.ip_address ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sensitive account activity ────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Sensitive Account Activity (30 days)</h2>
            <p className="mt-0.5 text-xs text-gray-500">Password resets, suspensions, role and plan changes</p>
          </div>
          <Link href="/platform-operator/audit-logs" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            Full audit log <Eye className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Action</th>
                <th className="px-5 py-2.5 text-left font-medium">Actor</th>
                <th className="px-5 py-2.5 text-left font-medium">IP</th>
                <th className="px-5 py-2.5 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(sensitiveEvents ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No sensitive account activity in the last 30 days.</td></tr>
              ) : (
                (sensitiveEvents ?? []).map((e: any) => (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3"><StatusChip tone={['user_deleted', 'company_suspended', 'password_set'].includes(e.action) ? 'danger' : 'info'}>{(e.action ?? '').replace(/_/g, ' ')}</StatusChip></td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{e.actor_email ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-500">{e.ip_address ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(e.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MFA & password posture per company ────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Security Posture by Company</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Company</th>
                <th className="px-5 py-2.5 text-left font-medium">MFA (Staff)</th>
                <th className="px-5 py-2.5 text-left font-medium">MFA (Admins)</th>
                <th className="px-5 py-2.5 text-right font-medium">Min Password</th>
                <th className="px-5 py-2.5 text-right font-medium">Session Timeout</th>
              </tr>
            </thead>
            <tbody>
              {(portfolios ?? []).map((p: any) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/platform-operator/companies/${p.id}`} className="font-medium text-gray-900 hover:underline">{p.company_name ?? '—'}</Link>
                  </td>
                  <td className="px-5 py-3"><StatusChip tone={p.require_mfa_for_staff ? 'success' : 'neutral'}>{p.require_mfa_for_staff ? 'Required' : 'Optional'}</StatusChip></td>
                  <td className="px-5 py-3"><StatusChip tone={p.require_mfa_for_admins ? 'success' : 'neutral'}>{p.require_mfa_for_admins ? 'Required' : 'Optional'}</StatusChip></td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-700">{p.password_min_length ?? '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-700">{p.session_timeout_minutes ? `${p.session_timeout_minutes}m` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── API keys ──────────────────────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">API Keys</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Key</th>
                <th className="px-5 py-2.5 text-left font-medium">Company</th>
                <th className="px-5 py-2.5 text-left font-medium">Last Used</th>
                <th className="px-5 py-2.5 text-left font-medium">Expires</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(apiKeys ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No API keys issued.</td></tr>
              ) : (
                (apiKeys ?? []).map((k: any) => {
                  const expired = k.expires_at && k.expires_at < today
                  return (
                    <tr key={k.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{k.name}</div>
                        <div className="font-mono text-xs text-gray-500">{k.prefix}…</div>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-gray-700">{k.portfolios?.company_name ?? '—'}</td>
                      <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{k.last_used_at ? date(k.last_used_at) : 'Never'}</td>
                      <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{k.expires_at ? date(k.expires_at) : '—'}</td>
                      <td className="px-5 py-3">
                        <StatusChip tone={k.revoked_at ? 'neutral' : expired ? 'danger' : 'success'}>
                          {k.revoked_at ? 'Revoked' : expired ? 'Expired' : 'Active'}
                        </StatusChip>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs leading-5 text-gray-400">
        Failed sign-in attempts and session-level events are available in the Supabase Auth logs; this page covers
        everything the platform records itself.
      </p>
    </div>
  )
}
