'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Communication Center', href: '/communication-center' },
  { label: 'Calendar', children: [
    { label: 'Association Calendar', href: '/calendar' },
    { label: 'New Event', href: '/calendar/new' },
  ]},
  { label: 'Automation Center', href: '/automation-center' },
  { label: 'Associations', href: '/associations' },
  { label: 'People', children: [
    { label: 'Owners', href: '/owners' },
    { label: 'Tenants', href: '/owners?view=tenants' },
    { label: 'Vendors', href: '/vendors' },
  ]},
  { label: 'Accounting', children: [
    { label: 'Receivables', href: '/charges' },
    { label: 'Payables', href: '/bills' },
    { label: 'Bank Accounts', href: '/bank-accounts' },
    { label: 'Journal Entries', href: '/journal-entries' },
    { label: 'Bank Transfers', href: '/bank-transfers' },
    { label: 'GL Accounts', href: '/gl-accounts' },
    { label: 'Diagnostics', href: '/diagnostics' },
    { label: 'Charge Categories', href: '/charge-categories' },
  ]},
  { label: 'Maintenance', children: [
    { label: 'Work Orders', href: '/work-orders' },
    { label: 'Recurring Work Orders', href: '/recurring-work-orders' },
    { label: 'Inspections', href: '/inspections' },
    { label: 'Unit Turns', href: '/unit-turns' },
    { label: 'Projects', href: '/projects' },
    { label: 'Purchase Orders', href: '/purchase-orders' },
    { label: 'Inventory', href: '/inventory' },
    { label: 'Fixed Assets', href: '/fixed-assets' },
  ]},
  { label: 'Violations', href: '/violations' },
  { label: 'Reporting', children: [
    { label: 'Reports', href: '/reports' },
    { label: 'Scheduled Reports', href: '/scheduled-reports' },
    { label: 'Metrics', href: '/metrics' },
    { label: 'Surveys', href: '/surveys' },
  ]},
  { label: 'Communication', children: [
    { label: 'Letters', href: '/letters' },
    { label: 'Forms', href: '/forms' },
    { label: 'Inbox', href: '/inbox' },
    { label: 'Send Email', href: '/send-email' },
  ]},
]

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Sidebar({ portfolioName, userEmail }: { portfolioName?: string; userEmail?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const defaults: Record<string, boolean> = {}
  NAV.forEach((s: any) => {
    if (s.children) defaults[s.label] = s.children.some((i: any) => pathname.startsWith(i.href.split('?')[0]))
  })
  const [open, setOpen] = useState<Record<string, boolean>>(defaults)

  useEffect(() => {
    setOpen(prev => {
      const next = { ...prev }
      NAV.forEach((s: any) => {
        if (s.children && s.children.some((i: any) => pathname.startsWith(i.href.split('?')[0]))) {
          next[s.label] = true
        }
      })
      return next
    })
  }, [pathname])

  const toggle = (label: string) => setOpen(p => ({ ...p, [label]: !p[label] }))
  const active = (href: string) => {
    const b = href.split('?')[0]
    return pathname === b || (b.length > 1 && pathname.startsWith(b))
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-52 flex-shrink-0 flex-col border-r border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{portfolioName ?? 'ManageOps'}</div>
        <div className="text-xs text-gray-400 mt-0.5">Operations workspace</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        {NAV.map((s: any) => {
          if (!s.children) return (
            <Link key={s.label} href={s.href}
              className={"flex items-center px-4 py-2 text-sm " + (active(s.href) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50')}>
              {s.label}
            </Link>
          )
          const isOpen = open[s.label]
          const isActive = s.children.some((i: any) => active(i.href))
          return (
            <div key={s.label}>
              <button onClick={() => toggle(s.label)}
                className={"flex w-full items-center justify-between px-4 py-2 text-sm " + (isActive ? 'text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50')}>
                <span>{s.label}</span>
                <ChevronDown open={isOpen} />
              </button>
              {isOpen && (
                <div className="border-l-2 border-gray-100 ml-4 bg-gray-50">
                  {s.children.map((c: any) => (
                    <Link key={c.href} href={c.href}
                      className={"block px-4 py-1.5 text-sm " + (active(c.href) ? 'text-blue-700 font-medium bg-blue-50' : 'text-gray-600 hover:bg-gray-100')}>
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="text-xs text-gray-500 truncate mb-1">{userEmail}</div>
        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">Log out</button>
      </div>
    </aside>
  )
}
