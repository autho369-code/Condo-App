import {
  TrendingUp,
  BarChart3,
} from 'lucide-react'

export default function BudgetPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
        <TrendingUp className="h-10 w-10 text-emerald-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">Budget</h1>
      <p className="mt-2 text-slate-400 text-center max-w-md">
        Association budget planning, tracking, and variance analysis will be available here.
      </p>
      <span className="mt-6 inline-flex h-8 items-center rounded-full bg-emerald-500/10 px-4 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
        Coming Soon
      </span>
    </div>
  )
}
