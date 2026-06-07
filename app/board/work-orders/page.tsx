import {
  Wrench,
} from 'lucide-react'

export default function WorkOrdersPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-6">
        <Wrench className="h-10 w-10 text-amber-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">Work Orders</h1>
      <p className="mt-2 text-slate-400 text-center max-w-md">
        Monitor maintenance requests, repair status, and work order completion across the association.
      </p>
      <span className="mt-6 inline-flex h-8 items-center rounded-full bg-amber-500/10 px-4 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">
        Coming Soon
      </span>
    </div>
  )
}
