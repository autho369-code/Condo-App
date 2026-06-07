import {
  Building2,
} from 'lucide-react'

export default function ProjectsPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-6">
        <Building2 className="h-10 w-10 text-violet-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">Projects</h1>
      <p className="mt-2 text-slate-400 text-center max-w-md">
        Track capital improvement projects, renovations, and association initiatives.
      </p>
      <span className="mt-6 inline-flex h-8 items-center rounded-full bg-violet-500/10 px-4 text-xs font-medium text-violet-400 ring-1 ring-violet-500/20">
        Coming Soon
      </span>
    </div>
  )
}
