import {
  ScrollText,
} from 'lucide-react'

export default function ReportsPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-6">
        <ScrollText className="h-10 w-10 text-orange-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">Reports</h1>
      <p className="mt-2 text-slate-400 text-center max-w-md">
        Generate and download financial reports, violation summaries, and association analytics.
      </p>
      <span className="mt-6 inline-flex h-8 items-center rounded-full bg-orange-500/10 px-4 text-xs font-medium text-orange-400 ring-1 ring-orange-500/20">
        Coming Soon
      </span>
    </div>
  )
}
