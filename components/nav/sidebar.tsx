'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { appModules } from '@/lib/navigation/modules'
import { createClient } from '@/lib/supabase/client'

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function Hamburger({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-white border border-gray-200 shadow-sm" aria-label="Toggle menu">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        {open ? (
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        ) : (
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        )}
      </svg>
    </button>
  )
}

export default function Sidebar({ portfolioName, logoUrl, brandColor, userEmail }: {
  portfolioName?: string;
  logoUrl?: string | null;
  brandColor?: string;
  userEmail?: string;
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const defaults: Record<string, boolean> = {}
  appModules.forEach((s) => {
    if (s.children) defaults[s.label] = s.children.some((i) => pathname.startsWith(i.href.split('?')[0]))
  })
  const [open, setOpen] = useState<Record<string, boolean>>(defaults)

  useEffect(() => {
    setOpen(prev => {
      const next = { ...prev }
      appModules.forEach((s) => {
        if (s.children && s.children.some((i) => pathname.startsWith(i.href.split('?')[0]))) {
          next[s.label] = true
        }
      })
      return next
    })
    // Close mobile menu on navigation
    setMobileOpen(false)
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

  const sidebarContent = (
    <aside className="flex h-screen w-52 flex-shrink-0 flex-col border-r border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-200 px-4 py-3 flex-shrink-0">
        {logoUrl ? (
          <img src={logoUrl} alt={portfolioName ?? 'Portal'} className="h-8 object-contain mb-1" />
        ) : (
          <div className="text-sm font-semibold text-gray-900 truncate">{portfolioName ?? 'ManageOps'}</div>
        )}
        <div className="text-xs text-gray-400 mt-0.5">Operations workspace</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        {appModules.map((s) => {
          if (!s.children) return (
            <Link key={s.label} href={s.href}
              className={"flex items-center px-4 py-2 text-sm " + (active(s.href) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50')}>
              {s.label}
            </Link>
          )
          const isOpen = open[s.label]
          const isActive = s.children.some((i: any) => active(i.href))
          const submenuId = `sidebar-submenu-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
          return (
            <div key={s.label}>
              <button onClick={() => toggle(s.label)}
                aria-expanded={!!isOpen}
                aria-controls={submenuId}
                className={"flex w-full items-center justify-between px-4 py-2 text-sm " + (isActive ? 'text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50')}>
                <span>{s.label}</span>
                <ChevronDown open={isOpen} />
              </button>
              {isOpen && (
                <div id={submenuId} className="border-l-2 border-gray-100 ml-4 bg-gray-50">
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

  return (
    <>
      <Hamburger open={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)} />
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)} />
      )}
      {/* Desktop: always visible. Mobile: slide in when open */}
      <div className={`fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {sidebarContent}
      </div>
    </>
  )
}
