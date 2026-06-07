'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Home, User, CreditCard, Wrench, AlertTriangle,
  Scale, MessageSquare, Calendar, FileText, Shield, Key, LogOut
} from 'lucide-react'

const nav = [
  { label: 'Dashboard', icon: Home, href: '/portal' },
  { label: 'My Account', icon: User, href: '/portal/account' },
  { label: 'Payments', icon: CreditCard, href: '/portal/pay' },
  { label: 'Work Orders', icon: Wrench, href: '/portal/work-orders' },
  { label: 'Violations', icon: AlertTriangle, href: '/portal/violations' },
  { label: 'Hearings', icon: Scale, href: '/portal/hearings' },
  { label: 'Communications', icon: MessageSquare, href: '/portal/communications' },
  { label: 'Calendar', icon: Calendar, href: '/portal/calendar' },
  { label: 'Documents', icon: FileText, href: '/portal/documents' },
  { label: 'Insurance', icon: Shield, href: '/portal/insurance' },
  { label: 'Lease', icon: Key, href: '/portal/lease' },
  { label: 'Profile', icon: User, href: '/portal/profile' },
]

export default function OwnerSidebar({ userName }: { userName?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-[220px] flex-shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-5">
        <div className="text-sm font-semibold text-gray-400">Portier369</div>
        {userName && <div className="mt-1 text-sm font-medium text-gray-900 truncate">{userName}</div>}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== '/portal' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-gray-200 px-5 py-4">
        <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  )
}
