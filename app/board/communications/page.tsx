import {
  MessageSquare,
} from 'lucide-react'

export default function CommunicationsPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-6">
        <MessageSquare className="h-10 w-10 text-cyan-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">Communications</h1>
      <p className="mt-2 text-slate-400 text-center max-w-md">
        Send announcements, newsletters, and notifications to association members.
      </p>
      <span className="mt-6 inline-flex h-8 items-center rounded-full bg-cyan-500/10 px-4 text-xs font-medium text-cyan-400 ring-1 ring-cyan-500/20">
        Coming Soon
      </span>
    </div>
  )
}
