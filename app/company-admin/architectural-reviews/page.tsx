import { requirePortfolioAdmin } from '@/lib/auth/me'
import { ClipboardCheck, Clock, CheckCircle, XCircle, Construction } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ArchitecturalReviewsPage() {
  await requirePortfolioAdmin()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Architectural Reviews</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Track architectural modification requests across your portfolio</p>
        </div>
      </div>

      {/* Stats Row — Placeholder */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Pending', value: 'Coming Soon', icon: Clock },
          { label: 'Approved', value: 'Coming Soon', icon: CheckCircle },
          { label: 'Denied', value: 'Coming Soon', icon: XCircle },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{item.label}</div>
                  <div className="mt-1.5 text-lg font-semibold text-gray-950">{item.value}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Placeholder Content */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Construction className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="mb-2 text-lg font-semibold tracking-[-0.01em] text-gray-950">Architectural Review Tracking Coming Soon</h2>
        <p className="mx-auto max-w-md text-sm text-gray-500">
          The architectural review module is currently being deployed. Once live, you will be able to review, approve, and track all architectural modification requests from this dashboard.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600">
          <ClipboardCheck className="h-4 w-4 text-emerald-600" />
          <span>Expected: Q3 2026</span>
        </div>
      </div>

      {/* Feature Preview */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: 'Submission Review', desc: 'Review plans, renderings, and material specs submitted by residents.' },
          { title: 'Approval Workflow', desc: 'Multi-step approval with committee review and board final sign-off.' },
          { title: 'Compliance Tracking', desc: 'Track approved modifications against deadlines and inspection dates.' },
          { title: 'Violation Integration', desc: 'Auto-generate violations for unapproved modifications.' },
          { title: 'Document Storage', desc: 'Store all architectural documents and decision letters.' },
          { title: 'Resident Portal', desc: 'Residents can submit and track their requests online.' },
        ].map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h3 className="text-sm font-medium text-gray-900">{feature.title}</h3>
            <p className="mt-1 text-xs text-gray-500">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
