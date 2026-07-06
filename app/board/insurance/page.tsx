import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date, money } from '@/lib/utils'
import { ShieldCheck, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

export default async function BoardInsurancePage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: docs }, { data: policies }] = await Promise.all([
    // Association-level insurance documents (master policy, certificates, ...)
    db.from('documents')
      .select('id, doc_type, file_name, file_url, expires_at, uploaded_at')
      .eq('entity_type', 'association')
      .in('entity_id', ids)
      .order('uploaded_at', { ascending: false }),
    db.from('insurance_policies')
      .select('id, policy_number, insurance_company, coverage_amount, liability_amount, effective_date, expiration_date, status, owners(full_name)')
      .in('association_id', ids)
      .is('archived_at', null)
      .order('expiration_date'),
  ])

  const insuranceDocs = (docs ?? []).filter((d: any) => /insurance|policy|coi|certificate/i.test(`${d.doc_type} ${d.file_name}`))
  const current = (policies ?? []).filter((p: any) => p.expiration_date && p.expiration_date >= today)
  const expired = (policies ?? []).filter((p: any) => !p.expiration_date || p.expiration_date < today)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Insurance</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Association insurance documents and owner policy compliance
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { label: 'Insurance Documents', value: insuranceDocs.length, icon: FileText, warn: false },
          { label: 'Current Owner Policies', value: current.length, icon: ShieldCheck, warn: false },
          { label: 'Expired / Missing', value: expired.length, icon: ShieldCheck, warn: expired.length > 0 },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className={`${card} px-4 py-3.5`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{item.label}</div>
                  <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${item.warn ? 'text-red-700' : 'text-gray-950'}`}>{item.value}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Association Insurance Documents</h2>
          <p className="mt-0.5 text-xs text-gray-500">Master policies, certificates, and related documents on file</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Document</th>
                <th className="px-5 py-2.5 text-left font-medium">Uploaded</th>
                <th className="px-5 py-2.5 text-left font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {insuranceDocs.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-500">No insurance documents uploaded yet — ask your manager to upload the master policy and current certificates.</td></tr>
              ) : (
                insuranceDocs.map((d: any) => (
                  <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      {d.file_url ? (
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="font-medium text-gray-900 hover:underline">{d.file_name ?? 'Document'}</a>
                      ) : (
                        <span className="font-medium text-gray-900">{d.file_name ?? 'Document'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(d.uploaded_at)}</td>
                    <td className="px-5 py-3">
                      {d.expires_at
                        ? d.expires_at < today
                          ? <StatusChip tone="danger">Expired {date(d.expires_at)}</StatusChip>
                          : <span className="text-[13px] tabular-nums text-gray-700">{date(d.expires_at)}</span>
                        : <span className="text-[13px] text-gray-400">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Owner Policies (HO-6)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Owner</th>
                <th className="px-5 py-2.5 text-left font-medium">Carrier</th>
                <th className="px-5 py-2.5 text-right font-medium">Coverage</th>
                <th className="px-5 py-2.5 text-left font-medium">Expires</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(policies ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No owner insurance policies on file.</td></tr>
              ) : (
                (policies ?? []).map((p: any) => {
                  const isExpired = !p.expiration_date || p.expiration_date < today
                  return (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-5 py-3 font-medium text-gray-900">{p.owners?.full_name ?? '—'}</td>
                      <td className="px-5 py-3 text-[13px] text-gray-700">{p.insurance_company ?? '—'}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">{p.coverage_amount ? money(Number(p.coverage_amount)) : '—'}</td>
                      <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(p.expiration_date)}</td>
                      <td className="px-5 py-3"><StatusChip tone={isExpired ? 'danger' : 'success'}>{isExpired ? 'Expired' : 'Current'}</StatusChip></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
