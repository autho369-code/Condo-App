import Link from 'next/link'
import { FileBarChart, AlertTriangle, DollarSign, Wrench, Scale } from 'lucide-react'

export default function BoardReportsPage() {
  const reports = [
    { label: 'Violation Summary', desc: 'Open, closed, and pending violations by type and status', icon: AlertTriangle, href: '/board/violations/analytics', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Delinquency Report', desc: 'Past-due accounts, aging summary, and collection status', icon: DollarSign, href: '/board/delinquencies', color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Financial Summary', desc: 'YTD income, expenses, budget variance, and bank balances', icon: FileBarChart, href: '/board/financials', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Work Order Summary', desc: 'Open, in-progress, and completed work orders by category', icon: Wrench, href: '/board/work-orders', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Architectural Review Summary', desc: 'Pending, approved, and denied modification requests', icon: Scale, href: '/board/architectural-reviews', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Budget vs Actual', desc: 'Monthly budget performance with variance tracking', icon: FileBarChart, href: '/board/budget', color: 'text-sky-400', bg: 'bg-sky-500/10' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="mt-1 text-sm text-slate-400">Board-level reports and summaries for your association</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(r => (
          <Link key={r.label} href={r.href} className="rounded-xl border border-[#1E293B] p-5 hover:border-emerald-500/30 transition-colors group" style={{ backgroundColor: '#0B1121' }}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${r.bg} border border-[#1E293B] mb-3`}>
              <r.icon className={`h-5 w-5 ${r.color}`} />
            </div>
            <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">{r.label}</h3>
            <p className="mt-1 text-sm text-slate-500">{r.desc}</p>
            <span className="mt-3 inline-block text-xs font-medium text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">View report →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
