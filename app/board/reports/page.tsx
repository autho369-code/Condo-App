import Link from 'next/link'
import { FileBarChart, AlertTriangle, DollarSign, Wrench, Scale } from 'lucide-react'

export default function BoardReportsPage() {
  const reports = [
    { label: 'Violation Summary', desc: 'Open, closed, and pending violations by type and status', icon: AlertTriangle, href: '/board/violations/analytics', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Delinquency Report', desc: 'Past-due accounts, aging summary, and collection status', icon: DollarSign, href: '/board/delinquencies', color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Financial Summary', desc: 'YTD income, expenses, budget variance, and bank balances', icon: FileBarChart, href: '/board/financials', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Work Order Summary', desc: 'Open, in-progress, and completed work orders by category', icon: Wrench, href: '/board/work-orders', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Architectural Review Summary', desc: 'Pending, approved, and denied modification requests', icon: Scale, href: '/board/architectural-reviews', color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Budget vs Actual', desc: 'Monthly budget performance with variance tracking', icon: FileBarChart, href: '/board/budget', color: 'text-sky-600', bg: 'bg-sky-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Reports</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Board-level reports and summaries for your association</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(r => (
          <Link
            key={r.label}
            href={r.href}
            className="group rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_1px_3px_rgba(16,24,40,0.08),0_4px_12px_-4px_rgba(16,24,40,0.1)]"
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
