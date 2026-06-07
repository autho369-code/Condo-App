import {
  FileText,
} from 'lucide-react'

export default function DocumentsPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-500/10 border border-slate-500/20 mb-6">
        <FileText className="h-10 w-10 text-slate-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">Documents</h1>
      <p className="mt-2 text-slate-400 text-center max-w-md">
        Access governing documents, meeting minutes, resolutions, and association records.
      </p>
      <span className="mt-6 inline-flex h-8 items-center rounded-full bg-slate-500/10 px-4 text-xs font-medium text-slate-400 ring-1 ring-slate-500/20">
        Coming Soon
      </span>
    </div>
  )
}
