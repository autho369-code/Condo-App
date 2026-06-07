import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'

export const dynamic = 'force-dynamic'

export default async function BoardVendorsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  // Find vendors serving this association via work_orders
  const { data: vendorWos } = await db
    .from('work_orders')
    .select('vendor_id')
    .in('association_id', ids)
    .is('archived_at', null)
    .not('vendor_id', 'is', null)

  const vendorIds = [...new Set((vendorWos ?? []).map((v: any) => v.vendor_id))]

  let vendors: any[] = []
  if (vendorIds.length > 0) {
    const { data } = await db
      .from('vendors')
      .select('id, name, vendor_type, trade, phone_numbers, emails, workers_comp_expiration, general_liability_expiration, auto_insurance_expiration, epa_certification_expiration, state_license_expiration, contract_expiration')
      .in('id', vendorIds)
      .is('archived_at', null)
    vendors = data ?? []
  }

  // Compliance check
  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 86400000)
  const fields = ['workers_comp_expiration','general_liability_expiration','auto_insurance_expiration','epa_certification_expiration','state_license_expiration','contract_expiration']

  const getCompliance = (v: any) => {
    let expired = false, soon = false
    for (const f of fields) {
      const d = v[f] ? new Date(v[f]) : null
      if (d && d < now) expired = true
      else if (d && d < thirtyDays) soon = true
    }
    return { expired, soon, cls: expired ? 'bg-red-500/10 text-red-400 border-red-500/20' : soon ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: expired ? 'Expired' : soon ? 'Expiring' : 'Compliant' }
  }

  const issues = vendors.filter((v: any) => getCompliance(v).expired || getCompliance(v).soon)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Vendors</h1>
        <p className="mt-1 text-sm text-slate-400">Vendors providing services to your association</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Active Vendors', value: vendors.length, cls: 'text-white' },
          { label: 'Compliance Issues', value: issues.length, cls: issues.length > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Compliant', value: vendors.length - issues.length, cls: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
            <div className="text-xs font-medium uppercase text-slate-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1E293B] overflow-hidden" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Vendor</th>
              <th className="px-4 py-3 text-left font-medium">Trade</th>
              <th className="px-4 py-3 text-left font-medium">Contact</th>
              <th className="px-4 py-3 text-center font-medium">Compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {vendors.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500">No vendors assigned to work orders in your association.</td></tr>
            ) : (
              vendors.map((v: any) => {
                const c = getCompliance(v)
                const phones = Array.isArray(v.phone_numbers) ? v.phone_numbers : []
                const emails = Array.isArray(v.emails) ? v.emails : []
                return (
                  <tr key={v.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-slate-200">{v.name}</td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{v.trade ?? v.vendor_type ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {emails[0] && <div>{emails[0]}</div>}
                      {phones[0] && <div>{phones[0]}</div>}
                      {!emails[0] && !phones[0] && '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${c.cls}`}>{c.label}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
