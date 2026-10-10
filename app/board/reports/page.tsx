import Link from 'next/link'
import { FileBarChart, FileText } from 'lucide-react'
import { requireBoard } from '@/lib/auth/me'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isScopedStoragePath } from '@/lib/security/storage-paths'
import { date } from '@/lib/utils'
import { Alert } from '@/components/ui/shell'

export const dynamic = 'force-dynamic'

export default async function BoardReportsPage() {
  const me = await requireBoard()
  const ids = me.board_association_ids ?? []
  const db = (await createClient()) as any
  // RLS limits this to packages shared with the board for the member's associations.
  const { data: packages, error: packagesError } = ids.length
    ? await db.from('documents')
        .select('id, entity_id, file_name, file_url, uploaded_at, description')
        .eq('entity_type', 'association').eq('doc_type', 'board_report').in('entity_id', ids)
        .order('uploaded_at', { ascending: false }).limit(24)
    : { data: [], error: null }
  const { data: assocRows } = ids.length > 1 ? await db.from('associations').select('id, name').in('id', ids) : { data: [] }
  const nameById = new Map<string, string>(((assocRows ?? []) as any[]).map((a) => [a.id, a.name]))
  const links = new Map<string, string>()
  const toSign = ((packages ?? []) as any[]).filter((d) => isScopedStoragePath(d.file_url, 'associations', d.entity_id))
  if (toSign.length) {
    try {
      const { data: signed } = await (createServiceClient() as any).storage.from('association-documents').createSignedUrls(toSign.map((d) => d.file_url), 3600)
      const byPath = new Map<string, string>((signed ?? []).filter((x: any) => x?.signedUrl).map((x: any) => [x.path, x.signedUrl]))
      for (const d of toSign) { const u = byPath.get(d.file_url); if (u) links.set(d.id, u) }
    } catch {}
  }

  const reports = [
    { label: 'Financial Summary', desc: 'YTD income, expenses, budget variance, and bank balances', icon: FileBarChart, href: '/board/financials', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Budget vs Actual', desc: 'Monthly budget performance with variance tracking', icon: FileBarChart, href: '/board/budget', color: 'text-sky-600', bg: 'bg-sky-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Reports</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Board-level reports and summaries for your association</p>
      </div>

      <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Monthly board packages</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">Financial statements published by your management company.</p>
        </div>
        {packagesError ? (
          <div className="p-5"><Alert tone="danger" title="Board packages could not be loaded">{packagesError.message}</Alert></div>
        ) : (packages ?? []).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">No board packages have been published yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(packages ?? []).map((p: any) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    {links.has(p.id)
                      ? <a href={links.get(p.id)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:underline">{p.file_name}</a>
                      : <span className="text-sm font-medium text-gray-900">{p.file_name}</span>}
                    <div className="text-[13px] text-gray-500">{nameById.get(p.entity_id) ? `${nameById.get(p.entity_id)} · ` : ''}{p.description}</div>
                  </div>
                </div>
                <span className="text-xs tabular-nums text-gray-500">Published {date(p.uploaded_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(r => (
          <Link
            key={r.label}
            href={r.href}
            className="group rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_1px_3px_rgba(16,24,40,0.08),0_4px_12px_-4px_rgba(16,24,40,0.1)]"
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${r.bg}`}>
              <r.icon className={`h-5 w-5 ${r.color}`} />
            </div>
            <h3 className="font-semibold text-gray-950">{r.label}</h3>
            <p className="mt-1 text-sm text-gray-500">{r.desc}</p>
            <span className="mt-3 inline-block text-xs font-medium text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">View report →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
