'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { appModules } from '@/lib/navigation/modules'
import { createClient } from '@/lib/supabase/client'

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
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

  const itemBase =
    'flex items-center h-[34px] px-3 mx-2 rounded-md text-[13px] font-medium transition-colors duration-100'
  const itemIdle = 'text-[#8a8a93] hover:text-[#e4e4e7] hover:bg-white/[0.04]'
  const itemActive = 'bg-[#16161a] text-[#f4f4f5]'

  const sidebarContent = (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#060709]">
      {/* Workspace header */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-4">
        {logoUrl ? (
          <img src={logoUrl} alt={portfolioName ?? 'Portal'} className="mb-1 h-8 object-contain" />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.06] text-[12px] font-semibold text-white">
              {(portfolioName ?? 'P').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#f4f4f5]">
                {portfolioName ?? 'Portier369'}
              </div>
              <div className="text-[11px] leading-4 text-[#52525b]">Operations workspace</div>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 [scrollbar-width:thin] [scrollbar-color:#27272a_transparent]">
        {appModules.map((s) => {
          if (!s.children) return (
            <Link key={s.label} href={s.href}
              className={itemBase + ' ' + (active(s.href) ? itemActive : itemIdle)}>
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
                className={itemBase + ' w-[calc(100%-16px)] justify-between ' + (isActive && !isOpen ? itemActive : itemIdle)}>
                <span>{s.label}</span>
                <span className={isOpen ? 'text-[#71717a]' : 'text-[#3f3f46]'}>
                  <ChevronDown open={!!isOpen} />
                </span>
              </button>
              {isOpen && (
                <div id={submenuId} className="relative my-0.5 ml-[22px] border-l border-white/[0.07] pl-1">
                  {s.children.map((c: any) => (
                    <Link key={c.href} href={c.href}
                      className={
                        'flex h-[30px] items-center rounded-md px-3 text-[12.5px] transition-colors duration-100 ' +
                        (active(c.href)
                          ? 'bg-[#16161a] font-medium text-[#f4f4f5]'
                          : 'text-[#71717a] hover:bg-white/[0.04] hover:text-[#d4d4d8]')
                      }>
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-medium uppercase text-[#a1a1aa]">
            {(userEmail ?? '?').charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-[#d4d4d8]">{userEmail}</div>
            <button onClick={handleLogout} className="text-[11px] text-[#52525b] transition-colors hover:text-[#a1a1aa]">
              Log out
            </button>
          </div>
        </div>
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
