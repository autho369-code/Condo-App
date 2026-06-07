import {
  ClipboardCheck,
} from 'lucide-react'

export default function ArchitecturalReviewsPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
        <ClipboardCheck className="h-10 w-10 text-blue-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">Architectural Reviews</h1>
      <p className="mt-2 text-slate-400 text-center max-w-md">
        Review and approve architectural modification requests from owners.
      </p>
      <span className="mt-6 inline-flex h-8 items-center rounded-full bg-blue-500/10 px-4 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20">
        Coming Soon
      </span>
    </div>
  )
}
