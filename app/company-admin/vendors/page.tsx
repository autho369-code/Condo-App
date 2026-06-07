import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Truck, ShieldCheck, ShieldAlert, Shield, Banknote, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

function ComplianceBadge({ vendor }: { vendor: any }) {
  const now = new Date()
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86400000)
  const dates = [
    vendor.workers_comp_expiration,
    vendor.general_liability_expiration,
    vendor.auto_insurance_expiration,
    vendor.epa_certification_expiration,
    vendor.state_license_expiration,
    vendor.contract_expiration,
  ].filter(Boolean)

  if (dates.length === 0) {
    return <span className="inline-flex h-6 items-center rounded-full bg-slate-500/10 px-2.5 text-xs font-medium text-slate-400 ring-1 ring-slate-500/20">No Dates</span>
  }

  const hasExpired = dates.some((d) => new Date(d) < now)
  const expiringSoon = dates.some((d) => {
    const dt = new Date(d)
    return dt >= now && dt <= thirtyDaysOut
  })

  if (hasExpired) {
    return <span className="inline-flex h-6 items-center rounded-full bg-red-500/10 px-2.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20">Non-Compliant</span>
  }
  if (expiringSoon) {
    return <span className="inline-flex h-6 items-center rounded-full bg-amber-500/10 px-2.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">Expiring Soon</span>
  }
  return <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">Compliant</span>
}

function firstFromJsonb(arr: any): string {
  if (!arr) return '—'
  if (Array.isArray(arr)) return arr[0] ?? '—'
  return '—'
}

function calcComplianceIssues(vendor: any): boolean {
  const now = new Date()
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86400000)
  const dates = [
    vendor.workers_comp_expiration,
    vendor.general_liability_expiration,
    vendor.auto_insurance_expiration,
    vendor.epa_certification_expiration,
    vendor.state_license_expiration,
    vendor.contract_expiration,
  ].filter(Boolean)

  return dates.some((d) => new Date(d) < now || (new Date(d) >= now && new Date(d) <= thirtyDaysOut))
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ trade?: string }>
}) {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const sp = await searchParams

  // Fetch vendors
  let query = db
    .from('vendors')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name')

  if (sp.trade) {
    query = query.eq('trade', sp.trade)
  }

  const { data: vendors } = await query
  const vendorIds = (vendors ?? []).map((v: any) => v.id)

  // Count open work orders per vendor
  const { data: woCounts } = await db
    .from('work_orders')
    .select('vendor_id, id')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")')
    .in('vendor_id', vendorIds.length > 0 ? vendorIds : ['none'])

  const woByVendor = new Map<string, number>()
  for (const wo of woCounts ?? []) {
    if (wo.vendor_id) woByVendor.set(wo.vendor_id, (woByVendor.get(wo.vendor_id) ?? 0) + 1)
  }

  // Get distinct trades for filter
  const { data: allVendors } = await db
    .from('vendors')
    .select('trade')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)

  const trades = [...new Set((allVendors ?? []).map((v: any) => v.trade).filter(Boolean))].sort() as string[]

  // Stats
  const totalVendors = (vendors ?? []).length
  const achEnrolled = (vendors ?? []).filter((v: any) => v.ach_status === 'enrolled' || v.ach_status === 'verified').length
  const complianceIssues = (vendors ?? []).filter((v: any) => calcComplianceIssues(v)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendors</h1>
          <p className="mt-1 text-sm text-slate-400">Manage vendors and monitor compliance across your portfolio</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Vendors', value: totalVendors, icon: Truck, accent: 'emerald' },
          { label: 'ACH Enrolled', value: achEnrolled, icon: Banknote, accent: 'blue' },
          { label: 'Compliance Issues', value: complianceIssues, icon: ShieldAlert, accent: complianceIssues > 0 ? 'red' : 'emerald' },
          { label: 'Open Work Orders', value: (woCounts ?? []).length, icon: Shield, accent: 'violet' },
        ].map((item) => {
          const accents: Record<string, string> = {
            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            red: 'bg-red-500/10 text-red-400 border-red-500/20',
            violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
          }
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">{item.label}</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-white">{item.value}</div>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[item.accent]}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <form action="/company-admin/vendors" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
        <label className="text-xs font-medium uppercase text-slate-500">
          Trade
          <select name="trade" defaultValue={sp.trade ?? ''} className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All Trades</option>
            {trades.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">Apply</button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Vendor</th>
              <th className="px-4 py-3 text-left font-medium">Trade</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Compliance</th>
              <th className="px-4 py-3 text-right font-medium">Open WO</th>
              <th className="px-4 py-3 text-left font-medium">ACH</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {(vendors ?? []).length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No vendors found.</td></tr>
            ) : (
              (vendors ?? []).map((v: any) => {
                const openWO = woByVendor.get(v.id) ?? 0
                return (
                  <tr key={v.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link href={`/vendors/${v.id}`} className="font-medium text-slate-200 hover:text-emerald-400">
                        {v.name ?? 'Unnamed Vendor'}
                      </Link>
                      {v.vendor_type && <div className="mt-0.5 text-xs text-slate-500">{v.vendor_type}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-400">{v.trade ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{firstFromJsonb(v.phone_numbers)}</td>
                    <td className="px-4 py-3 text-slate-400">{firstFromJsonb(v.emails)}</td>
                    <td className="px-4 py-3"><ComplianceBadge vendor={v} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {openWO > 0 ? <span className="text-amber-400">{openWO}</span> : <span className="text-emerald-400">0</span>}
                    </td>
                    <td className="px-4 py-3">
                      {v.ach_status ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                          {v.ach_status === 'verified' ? 'Verified' : 'Enrolled'}
                        </span>
                      ) : (
                        <span className="inline-flex h-6 items-center rounded-full bg-slate-500/10 px-2.5 text-xs font-medium text-slate-400 ring-1 ring-slate-500/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/vendors/${v.id}`} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" title="View">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-600">
        Showing {(vendors ?? []).length} vendors
        {sp.trade && ` in ${sp.trade}`}
      </div>
    </div>
  )
}
