import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { FileText, FolderOpen, FileWarning } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

const DOC_TYPE_LABEL: Record<string, string> = {
  bylaws: 'Governing Documents',
  ccr: 'Governing Documents',
  minutes: 'Board Minutes',
  contract: 'Contracts',
  insurance: 'Insurance',
  audit: 'Audits',
  tax: 'Tax Documents',
  reserve_study: 'Reserve Studies',
  other: 'Other',
}

export default async function GlobalDocumentsPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: docs }, { data: assocs }] = await Promise.all([
    db.from('documents').select('id, entity_type, entity_id, doc_type, file_name, file_url, expires_at, uploaded_at').order('uploaded_at', { ascending: false }).limit(500),
    db.from('associations').select('id, name').eq('portfolio_id', portfolioId).is('archived_at', null),
  ])

  const assocName = new Map<string, string>((assocs ?? []).map((a: any) => [a.id, a.name]))

  // Group by document category.
  const groups = new Map<string, any[]>()
  for (const d of docs ?? []) {
    const label = DOC_TYPE_LABEL[d.doc_type] ?? 'Other'
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(d)
  }
  const expiringDocs = (docs ?? []).filter((d: any) => d.expires_at && d.expires_at < today)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Document Repository</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Global repository across every association — governing documents, minutes, contracts, insurance, and audits
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { label: 'Total Documents', value: (docs ?? []).length, icon: FileText },
          { label: 'Categories', value: groups.size, icon: FolderOpen },
          { label: 'Expired Documents', value: expiringDocs.length, icon: FileWarning, warn: expiringDocs.length > 0 },
        ].map((item: any) => {
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

      {groups.size === 0 ? (
        <div className={`${card} px-5 py-12 text-center text-sm text-gray-500`}>
          No documents uploaded yet. Managers upload association documents from the Documents section of the operations workspace.
        </div>
      ) : (
        [...groups.entries()].map(([label, items]) => (
          <div key={label} className={card}>
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-950">{label}</h2>
              <p className="mt-0.5 text-xs text-gray-500">{items.length} document{items.length === 1 ? '' : 's'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium">File</th>
                    <th className="px-5 py-2.5 text-left font-medium">Association</th>
                    <th className="px-5 py-2.5 text-left font-medium">Uploaded</th>
                    <th className="px-5 py-2.5 text-left font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d: any) => (
                    <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        {d.file_url ? (
                          <a href={d.file_url} target="_blank" rel="noreferrer" className="font-medium text-gray-900 hover:underline">{d.file_name ?? 'Document'}</a>
                        ) : (
                          <span className="font-medium text-gray-900">{d.file_name ?? 'Document'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-gray-700">
                        {d.entity_type === 'association' ? (assocName.get(d.entity_id) ?? '—') : d.entity_type}
                      </td>
                      <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(d.uploaded_at)}</td>
                      <td className="px-5 py-3">
                        {d.expires_at ? (
                          d.expires_at < today
                            ? <StatusChip tone="danger">Expired {date(d.expires_at)}</StatusChip>
                            : <span className="text-[13px] tabular-nums text-gray-700">{date(d.expires_at)}</span>
                        ) : (
                          <span className="text-[13px] text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
