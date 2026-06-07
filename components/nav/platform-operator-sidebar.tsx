'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Mail,
  Users,
  CreditCard,
  DoorOpen,
  TrendingUp,
  Activity,
  MessageSquare,
  MessageCircle,
  Database,
  ScrollText,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { label: 'Overview', href: '/platform-operator', icon: LayoutDashboard },
  { label: 'Companies', href: '/platform-operator/companies', icon: Building2 },
  { label: 'Invitations', href: '/platform-operator/invitations', icon: Mail },
  { label: 'Users', href: '/platform-operator/users', icon: Users },
  { label: 'Billing', href: '/platform-operator/billing', icon: CreditCard },
  { label: 'Door Usage', href: '/platform-operator/door-usage', icon: DoorOpen },
  { label: 'Revenue', href: '/platform-operator/revenue', icon: TrendingUp },
  { label: 'Association Health', href: '/platform-operator/association-health', icon: Activity },
  { label: 'Communications', href: '/platform-operator/communications', icon: MessageSquare },
  { label: 'Support Requests', href: '/platform-operator/support', icon: MessageCircle },
  { label: 'Supabase Admin', href: '/platform-operator/supabase-admin', icon: Database },
  { label: 'Audit Logs', href: '/platform-operator/audit-logs', icon: ScrollText },
]

export default function PlatformOperatorSidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string) => {
    const base = href.split('?')[0]
    return pathname === base || (base.length > 1 && pathname.startsWith(base))
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-[240px] flex-shrink-0 flex-col overflow-hidden border-r border-[#E5E7EB] bg-white">
      {/* Branding */}
      <div className="flex-shrink-0 border-b border-[#E5E7EB] px-5 py-4">
        <div className="truncate text-sm font-semibold" style={{ color: '#1E3A5F' }}>
          Portier369
        </div>
        <div className="mt-0.5 text-xs text-gray-500">Platform Operator</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                'mx-2 my-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ' +
                (active
                  ? 'font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
              }
              style={active ? { backgroundColor: 'rgba(30, 58, 95, 0.08)', color: '#1E3A5F' } : {}}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom user section */}
      <div className="flex-shrink-0 border-t border-[#E5E7EB] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
            {userEmail?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-gray-500">{userEmail}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
