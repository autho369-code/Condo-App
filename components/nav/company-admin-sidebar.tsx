'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  UserCheck,
  Truck,
  CreditCard,
  TrendingUp,
  MessageSquare,
  Send,
  ScrollText,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface MeResult {
  auth_user_id: string | null
  email: string | null
  profile: any
  portfolio: any
  role_name: string | null
  is_platform_operator: boolean
  is_full_access_staff: boolean
}

const navItems = [
  { label: 'Overview', href: '/company-admin/overview', icon: LayoutDashboard },
  { label: 'Associations', href: '/company-admin/associations', icon: Building2 },
  { label: 'Managers', href: '/company-admin/managers', icon: Users },
  { label: 'Portfolio Health', href: '/company-admin/portfolio-health', icon: Activity },
  { label: 'Work Orders', href: '/company-admin/work-orders', icon: Wrench },
  { label: 'Violations', href: '/company-admin/violations', icon: AlertTriangle },
  { label: 'Architectural Reviews', href: '/company-admin/architectural-reviews', icon: ClipboardCheck },
  { label: 'Owners', href: '/company-admin/owners', icon: UserCheck },
  { label: 'Vendors', href: '/company-admin/vendors', icon: Truck },
  { label: 'Billing & Doors', href: '/company-admin/billing', icon: CreditCard },
  { label: 'Revenue', href: '/company-admin/revenue', icon: TrendingUp },
  { label: 'Communications', href: '/company-admin/communications', icon: MessageSquare },
  { label: 'Platform Requests', href: '/company-admin/platform-requests', icon: Send },
  { label: 'Audit Logs', href: '/company-admin/audit-logs', icon: ScrollText },
  { label: 'Settings', href: '/company-admin/settings', icon: Settings },
]

export default function CompanyAdminSidebar({ me }: { me: MeResult }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/company-admin/overview' && pathname === '/company-admin') return true
    const base = href.split('?')[0]
    return pathname === base || (base.length > 1 && pathname.startsWith(base))
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const companyName = me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier369'
  const userEmail = me.email ?? ''

  const sidebarContent = (
    <aside className="flex h-screen w-[260px] flex-shrink-0 flex-col overflow-hidden border-r border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
      {/* Branding */}
      <div className="flex-shrink-0 border-b border-[#1E293B] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
            <Building2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{companyName}</div>
            <div className="text-xs text-slate-400">Company Admin</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                'mx-3 my-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ' +
                (active
                  ? 'bg-emerald-500/10 font-medium text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white')
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom user section */}
      <div className="flex-shrink-0 border-t border-[#1E293B] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-300">
            {userEmail?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-slate-400">{userEmail}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex-shrink-0 rounded p-1 text-slate-500 hover:bg-white/5 hover:text-slate-300"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md border border-[#1E293B] shadow-sm"
        style={{ backgroundColor: '#0B1121' }}
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X className="h-5 w-5 text-slate-300" />
        ) : (
          <Menu className="h-5 w-5 text-slate-300" />
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: mobile slide-in, desktop static */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  )
}
