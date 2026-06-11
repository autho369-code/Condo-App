import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip, type Tone } from '@/components/operations/status-chip'

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
  const fields = ['workers_comp_expiration', 'general_liability_expiration', 'auto_insurance_expiration', 'epa_certification_expiration', 'state_license_expiration', 'contract_expiration']

  const getCompliance = (v: any): { expired: boolean; soon: boolean; tone: Tone; label: string } => {
    let expired = false, soon = false
    for (const f of fields) {
      const d = v[f] ? new Date(v[f]) : null
      if (d && d < now) expired = true
      else if (d && d < thirtyDays) soon = true
    }
    return { expired, soon, tone: expired ? 'danger' : soon ? 'warning' : 'success', label: expired ? 'Expired' : soon ? 'Expiring' : 'Compliant' }
  }

  const issues = vendors.filter((v: any) => getCompliance(v).expired || getCompliance(v).soon)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Vendors</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Vendors providing services to your association</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Active Vendors', value: vendors.length },
          { label: 'Compliance Issues', value: issues.length },
          { label: 'Compliant', value: vendors.length - issues.length },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.label}</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Vendor</th>
              <th className="px-4 py-2.5 text-left font-medium">Trade</th>
              <th className="px-4 py-2.5 text-left font-medium">Contact</th>
              <th className="px-4 py-2.5 text-center font-medium">Compliance</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">No vendors assigned to work orders in your association.</td></tr>
            ) : (
              vendors.map((v: any) => {
                const c = getCompliance(v)
                const phones = Array.isArray(v.phone_numbers) ? v.phone_numbers : []
                const emails = Array.isArray(v.emails) ? v.emails : []
                return (
                  <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{v.name}</td>
                    <td className="px-4 py-3 text-[13px] capitalize text-gray-700">{v.trade ?? v.vendor_type ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {emails[0] && <div>{emails[0]}</div>}
                      {phones[0] && <div>{phones[0]}</div>}
                      {!emails[0] && !phones[0] && '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusChip tone={c.tone}>{c.label}</StatusChip>
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
