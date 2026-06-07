import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { money, date } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function OwnerViolationsPage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: viols } = await db.from('violations')
    .select('id, title, violation_type, status, date_observed, fine_amount, hearing_date, units!inner(unit_number)')
    .eq('owner_id', me.owner_id).is('archived_at', null)
    .order('date_observed', { ascending: false }).limit(100)

  const all = viols ?? []
  const statusB = (s: string) => {
    const m: Record<string, string> = { open: 'bg-amber-50 text-amber-700', pending: 'bg-blue-50 text-blue-700', closed: 'bg-gray-100 text-gray-600', cured: 'bg-emerald-50 text-emerald-700', under_review: 'bg-purple-50 text-purple-700' }
    return m[s] ?? 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Violations</h1>
        <p className="text-sm text-gray-500">View your violation history and status</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Open', value: all.filter((v: any) => !['closed','cured'].includes(v.status)).length, color: 'text-amber-600' },
          { label: 'Total Fines', value: money(all.reduce((s: number, v: any) => s + (v.fine_amount ?? 0), 0)), color: 'text-red-600' },
          { label: 'Hearings Scheduled', value: all.filter((v: any) => v.hearing_date).length, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="text-xs font-medium uppercase text-gray-500">{s.label}</div>
            <div className={`mt-1 text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {all.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-gray-500">No violations on your record.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 bg-gray-50">
                <th className="px-5 py-3 text-left font-medium">Violation</th>
                <th className="px-5 py-3 text-left font-medium">Unit</th>
                <th className="px-5 py-3 text-left font-medium">Type</th>
                <th className="px-5 py-3 text-center font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Fine</th>
                <th className="px-5 py-3 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {all.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/portal/violations/${v.id}`} className="font-medium text-gray-900 hover:text-blue-600">{v.title}</Link>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{v.units?.unit_number ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600 capitalize">{v.violation_type?.replace('_',' ') ?? '—'}</td>
                  <td className="px-5 py-3 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusB(v.status)}`}>{v.status.replace('_',' ')}</span></td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-600">{v.fine_amount ? money(v.fine_amount) : '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-500">{date(v.date_observed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
