import {
  Truck,
} from 'lucide-react'

export default function VendorsPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 mb-6">
        <Truck className="h-10 w-10 text-pink-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">Vendors</h1>
      <p className="mt-2 text-slate-400 text-center max-w-md">
        Manage vendor contracts, insurance certificates, and service provider relationships.
      </p>
      <span className="mt-6 inline-flex h-8 items-center rounded-full bg-pink-500/10 px-4 text-xs font-medium text-pink-400 ring-1 ring-pink-500/20">
        Coming Soon
      </span>
    </div>
  )
}
