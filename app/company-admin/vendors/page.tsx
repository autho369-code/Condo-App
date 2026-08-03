import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { Truck, ShieldAlert, Shield, Banknote } from 'lucide-react'
import { buildVendorPerformanceScorecard, type VendorPerformanceScorecard } from '@/lib/vendors/performance'
import { loadPortfolioVendorPerformanceRows } from '@/lib/vendors/performance-query'

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
    return <StatusChip tone="neutral">No Dates</StatusChip>
  }

  const hasExpired = dates.some((d) => new Date(d) < now)
  const expiringSoon = dates.some((d) => {
    const dt = new Date(d)
    return dt >= now && dt <= thirtyDaysOut
  })

  if (hasExpired) {
    return <StatusChip tone="danger">Non-Compliant</StatusChip>
  }
  if (expiringSoon) {
    return <StatusChip tone="warning">Expiring Soon</StatusChip>
  }
  return <StatusChip tone="success">Compliant</StatusChip>
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
  if (!portfolioId) throw new Error('Company-admin workspace is missing its management-company scope.')
  const sp = await searchParams

  const allVendorsPromise = db
    .from('vendors')
    .select('trade')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)

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

  const [performanceRows, { data: allVendors }] = await Promise.all([
    loadPortfolioVendorPerformanceRows(db, portfolioId, vendorIds),
    allVendorsPromise,
  ])
  const rowsByVendor = new Map<string, typeof performanceRows>()
  for (const row of performanceRows) {
    if (!row.vendor_id) continue
    const rows = rowsByVendor.get(row.vendor_id) ?? []
    rows.push(row)
    rowsByVendor.set(row.vendor_id, rows)
  }
  const performanceByVendor = new Map<string, VendorPerformanceScorecard>(
    (vendors ?? []).map((vendor: any) => [
      vendor.id,
      buildVendorPerformanceScorecard(
        rowsByVendor.get(vendor.id) ?? [],
        vendor,
      ),
    ]),
  )
  const openWorkOrders = [...performanceByVendor.values()].reduce((sum, scorecard) => sum + scorecard.open, 0)

  const trades = [...new Set((allVendors ?? []).map((v: any) => v.trade).filter(Boolean))].sort() as string[]

  // Stats
  const totalVendors = (vendors ?? []).length
  const achEnrolled = (vendors ?? []).filter((v: any) => v.ach_status === 'enrolled' || v.ach_status === 'verified').length
  const complianceIssues = (vendors ?? []).filter((v: any) => calcComplianceIssues(v)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Vendors</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Manage vendors and monitor compliance across your portfolio</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Vendors', value: totalVendors, icon: Truck },
          { label: 'ACH Enrolled', value: achEnrolled, icon: Banknote },
          { label: 'Compliance Issues', value: complianceIssues, icon: ShieldAlert },
          { label: 'Open Work Orders', value: openWorkOrders, icon: Shield },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{item.label}</div>
                  <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{item.value}</div>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <form action="/company-admin/vendors" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <label className="text-xs font-medium text-gray-500">
          Trade
          <select name="trade" defaultValue={sp.trade ?? ''} className="mt-1 block h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
            <option value="">All Trades</option>
            {trades.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-xl bg-gray-950 px-4 text-sm font-medium text-white transition hover:bg-gray-800">Apply</button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Vendor</th>
              <th className="px-4 py-2.5 text-left font-medium">Trade</th>
              <th className="px-4 py-2.5 text-left font-medium">Phone</th>
              <th className="px-4 py-2.5 text-left font-medium">Email</th>
              <th className="px-4 py-2.5 text-left font-medium">Compliance</th>
              <th className="px-4 py-2.5 text-left font-medium">Service Record</th>
              <th className="px-4 py-2.5 text-right font-medium">Open WO</th>
              <th className="px-4 py-2.5 text-left font-medium">ACH</th>
            </tr>
          </thead>
          <tbody>
            {(vendors ?? []).length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">No vendors found.</td></tr>
            ) : (
              (vendors ?? []).map((v: any) => {
                const scorecard = performanceByVendor.get(v.id)!
                return (
                  <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/vendors/${v.id}`} className="font-medium text-gray-900 hover:underline">{v.name ?? 'Unnamed Vendor'}</Link>
                      {v.vendor_type && <div className="mt-0.5 text-xs text-gray-500">{v.vendor_type}</div>}
                    </td>
                    <td className="px-4 py-3 text-[13px] capitalize text-gray-700">{v.trade ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{firstFromJsonb(v.phone_numbers)}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{firstFromJsonb(v.emails)}</td>
                    <td className="px-4 py-3"><ComplianceBadge vendor={v} /></td>
                    <td className="px-4 py-3">
                      <StatusChip tone={scorecard.serviceRecord.tone}>{scorecard.serviceRecord.label}</StatusChip>
                      <div className="mt-1 text-xs tabular-nums text-gray-500">
                        {scorecard.onTimeRate === null ? 'No scheduled completions' : `${scorecard.onTimeRate}% on time`} · {scorecard.completed} completed
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${scorecard.open > 0 ? 'font-medium text-amber-700' : 'text-gray-700'}`}>
                      {scorecard.open}
                    </td>
                    <td className="px-4 py-3">
                      {v.ach_status ? (
                        <StatusChip tone="success">{v.ach_status === 'verified' ? 'Verified' : 'Enrolled'}</StatusChip>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        Showing {(vendors ?? []).length} vendors
        {sp.trade && ` in ${sp.trade}`}
      </div>
    </div>
  )
}
