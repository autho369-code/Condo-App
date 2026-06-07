'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  DollarSign,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  ClipboardCheck,
  FolderKanban,
  Wrench,
  Truck,
  FileText,
  FileBarChart,
  MessageSquare,
  Building2,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { label: 'Dashboard', href: '/board', icon: LayoutDashboard },
  { label: 'Financials', href: '/board/financials', icon: DollarSign },
  { label: 'Budget vs Actual', href: '/board/budget', icon: BarChart3 },
  { label: 'Delinquencies', href: '/board/delinquencies', icon: AlertCircle },
  { label: 'Violations', href: '/board/violations', icon: AlertTriangle },
  { label: 'Architectural Reviews', href: '/board/architectural-reviews', icon: ClipboardCheck },
  { label: 'Projects', href: '/board/projects', icon: FolderKanban },
  { label: 'Work Orders', href: '/board/work-orders', icon: Wrench },
  { label: 'Vendors', href: '/board/vendors', icon: Truck },
  { label: 'Documents', href: '/board/documents', icon: FileText },
  { label: 'Reports', href: '/board/reports', icon: FileBarChart },
  { label: 'Communications', href: '/board/communications', icon: MessageSquare },
]

interface BoardSidebarProps {
  userEmail?: string
  associationName?: string
}

export default function BoardSidebar({ userEmail, associationName }: BoardSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/board' && pathname === '/board') return true
    const base = href.split('?')[0]
    return pathname === base || (base.length > 1 && pathname.startsWith(base))
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = associationName ?? 'Association'
  const email = userEmail ?? ''

  const sidebarContent = (
    <aside
      className="flex h-screen w-[240px] flex-shrink-0 flex-col overflow-hidden border-r border-[#1E293B]"
      style={{ backgroundColor: '#0B1121' }}
    >
      {/* Branding */}
      <div className="flex-shrink-0 border-b border-[#1E293B] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
            <Building2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{displayName}</div>
            <div className="text-xs text-slate-400">Board Member</div>
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
            {email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-slate-400">{email}</div>
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
