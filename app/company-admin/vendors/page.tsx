import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { Truck, ShieldAlert, Shield, Banknote } from 'lucide-react'
import { buildVendorPerformanceScorecard, type VendorPerformanceScorecard } from '@/lib/vendors/performance'
import { loadPortfolioVendorPerformanceRows } from '@/lib/vendors/performance-query'
import { vendorComplianceStatus, VENDOR_EXPIRATION_COLUMNS } from '@/lib/company-admin/vendor-compliance'
import { todayInZone } from '@/lib/time/zoned'
import { Alert } from '@/components/ui/shell'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { vendorAssociationLabel } from '@/lib/vendors/options'
import { collectLoadErrors } from '@/lib/company-admin/load-errors'

export const dynamic = 'force-dynamic'

function ComplianceBadge({ vendor, today }: { vendor: any; today: string }) {
  const status = vendorComplianceStatus(vendor, today)
  if (status === 'none') return <StatusChip tone="neutral">No Dates</StatusChip>
  if (status === 'expired') return <StatusChip tone="danger">Non-Compliant</StatusChip>
  if (status === 'expiring') return <StatusChip tone="warning">Expiring Soon</StatusChip>
  return <StatusChip tone="success">Compliant</StatusChip>
}

const ACH_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  active: { label: 'Active', tone: 'success' },
  verified: { label: 'Verified', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
}

function isAchEnrolled(status: string | null | undefined): boolean {
  return status === 'verified' || status === 'active'
}

function AchStatusChip({ status }: { status: string }) {
  const s = ACH_STATUS[status] ?? { label: status, tone: 'neutral' as const }
  return <StatusChip tone={s.tone}>{s.label}</StatusChip>
}

function firstFromJsonb(arr: any): string {
  if (!arr) return '—'
  if (Array.isArray(arr)) return arr[0] ?? '—'
  return '—'
}

function calcComplianceIssues(vendor: any, today: string): boolean {
  const status = vendorComplianceStatus(vendor, today)
  return status === 'expired' || status === 'expiring'
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
  const today = todayInZone()

  const allVendorsPromise = fetchAllRows(() => db
    .from('vendors')
    .select('id, trade')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('id'))

  // Fetch vendors (paged: a plain select stops at 1,000 rows)
  const vendorsRes = await fetchAllRows(() => {
    let query = db
      .from('vendors')
      // Explicit columns: vendors also holds bank and taxpayer numbers this
      // list never shows.
      .select(`id, name, vendor_type, trade, phone_numbers, emails, ach_status, is_management_company, associations(name), ${VENDOR_EXPIRATION_COLUMNS}`)
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null)
      .order('name')
      .order('id')
    if (sp.trade) query = query.eq('trade', sp.trade)
    return query
  })
  const vendors = vendorsRes.rows as any[]
  const vendorIds = vendors.map((v: any) => v.id)

  const [performanceRows, allVendorsRes] = await Promise.all([
    loadPortfolioVendorPerformanceRows(db, portfolioId, vendorIds),
    allVendorsPromise,
  ])
  const allVendors = allVendorsRes.rows as any[]
  const loadErrors = collectLoadErrors({ Vendors: vendorsRes, Trades: allVendorsRes })
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
  // vendors.ach_status is constrained to pending | verified | active; only
  // verified and active vendors can actually be paid by ACH.
  const achEnrolled = (vendors ?? []).filter((v: any) => isAchEnrolled(v.ach_status)).length
  const achPending = (vendors ?? []).filter((v: any) => v.ach_status === 'pending').length
  const complianceIssues = (vendors ?? []).filter((v: any) => calcComplianceIssues(v, today)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Vendors</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Manage vendors and monitor compliance across your portfolio</p>
        </div>
      </div>

      {loadErrors.length > 0 && <Alert tone="danger" title="Could not load vendors.">{loadErrors.join(' · ')}</Alert>}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Vendors', value: totalVendors, icon: Truck },
          { label: 'ACH Enrolled', value: achEnrolled, sub: achPending > 0 ? `${achPending} pending` : undefined, icon: Banknote },
          { label: 'Compliance Issues', value: complianceIssues, icon: ShieldAlert },
          { label: 'Open Work Orders', value: openWorkOrders, icon: Shield },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[13px] font-medium leading-5 text-gray-500">{item.label}</div>
                  <div className="mt-1.5 font-display text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{item.value}</div>
                  {item.sub && <div className="mt-1 text-[13px] text-gray-500">{item.sub}</div>}
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
      <form action="/company-admin/vendors" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <label className="text-[13px] font-medium text-gray-500">
          Trade
          <select name="trade" defaultValue={sp.trade ?? ''} className="mt-1 block h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
            <option value="">All Trades</option>
            {trades.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-xl bg-gray-950 px-4 text-sm font-medium text-white transition hover:bg-gray-800">Apply</button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Vendor</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Trade</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Phone</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Email</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Compliance</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Service Record</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Open WO</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">ACH</th>
            </tr>
          </thead>
          <tbody>
            {(vendors ?? []).length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">No vendors found.</td></tr>
            ) : (
              (vendors ?? []).map((v: any) => {
                const scorecard = performanceByVendor.get(v.id)!
                return (
                  <tr key={v.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-4 py-3.5">
                      <Link href={`/vendors/${v.id}`} className="font-medium text-gray-900 hover:underline">{v.name ?? 'Unnamed Vendor'}</Link>
                      <div className="mt-0.5 text-[13px] text-gray-500">{[vendorAssociationLabel(v), v.vendor_type].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] capitalize text-gray-700">{v.trade ?? '—'}</td>
                    <td className="px-4 py-3.5 text-sm tabular-nums text-gray-700">{firstFromJsonb(v.phone_numbers)}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">{firstFromJsonb(v.emails)}</td>
                    <td className="px-4 py-3.5"><ComplianceBadge vendor={v} today={today} /></td>
                    <td className="px-4 py-3.5">
                      <StatusChip tone={scorecard.serviceRecord.tone}>{scorecard.serviceRecord.label}</StatusChip>
                      <div className="mt-1 text-xs tabular-nums text-gray-500">
                        {scorecard.onTimeRate === null ? 'No scheduled completions' : `${scorecard.onTimeRate}% on time`} · {scorecard.completed} completed
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${scorecard.open > 0 ? 'font-medium text-amber-700' : 'text-gray-700'}`}>
                      {scorecard.open}
                    </td>
                    <td className="px-4 py-3.5">
                      {v.ach_status ? (
                        <AchStatusChip status={v.ach_status} />
                      ) : (
                        <span className="text-[13px] text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[13px] text-gray-500">
        Showing {(vendors ?? []).length} vendors
        {sp.trade && ` in ${sp.trade}`}
      </div>
    </div>
  )
}
