import { requirePortfolioAdmin } from '@/lib/auth/me'
import { ClipboardCheck, Clock, CheckCircle, XCircle, Construction } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ArchitecturalReviewsPage() {
  const me = await requirePortfolioAdmin()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Architectural Reviews</h1>
          <p className="mt-1 text-sm text-slate-400">Track architectural modification requests across your portfolio</p>
        </div>
      </div>

      {/* Stats Row — Placeholder */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Pending', value: 'Coming Soon', icon: Clock, accent: 'amber' },
          { label: 'Approved', value: 'Coming Soon', icon: CheckCircle, accent: 'emerald' },
          { label: 'Denied', value: 'Coming Soon', icon: XCircle, accent: 'red' },
        ].map((item) => {
          const accents: Record<string, string> = {
            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            red: 'bg-red-500/10 text-red-400 border-red-500/20',
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

      {/* Placeholder Content */}
      <div className="rounded-xl border border-[#1E293B] p-12 text-center" style={{ backgroundColor: '#0B1121' }}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-500/10 mb-4">
          <Construction className="h-8 w-8 text-slate-500" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Architectural Review Tracking Coming Soon</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          The architectural review module is currently being deployed. Once live, you will be able to review, approve, and track all architectural modification requests from this dashboard.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[#1E293B] px-4 py-2 text-sm text-slate-400">
          <ClipboardCheck className="h-4 w-4 text-emerald-400" />
          <span>Expected: Q3 2026</span>
        </div>
      </div>

      {/* Feature Preview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: 'Submission Review', desc: 'Review plans, renderings, and material specs submitted by residents.' },
          { title: 'Approval Workflow', desc: 'Multi-step approval with committee review and board final sign-off.' },
          { title: 'Compliance Tracking', desc: 'Track approved modifications against deadlines and inspection dates.' },
          { title: 'Violation Integration', desc: 'Auto-generate violations for unapproved modifications.' },
          { title: 'Document Storage', desc: 'Store all architectural documents and decision letters.' },
          { title: 'Resident Portal', desc: 'Residents can submit and track their requests online.' },
        ].map((feature) => (
          <div key={feature.title} className="rounded-lg border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
            <h3 className="text-sm font-medium text-slate-300">{feature.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
