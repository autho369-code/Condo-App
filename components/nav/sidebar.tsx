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
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Sidebar({ portfolioName, userEmail }: { portfolioName?: string; userEmail?: string }) {
  const pathname = usePathname()
  const router = useRouter()

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
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-slate-800/80 bg-[#0B1121] overflow-hidden">
      <div className="border-b border-slate-800/80 px-4 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex-shrink-0 shadow-lg shadow-emerald-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{portfolioName ?? 'Portier'}</div>
            <div className="text-[10px] text-slate-500 font-medium">Operations workspace</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2.5">
        {appModules.map((s) => {
          if (!s.children) return (
            <Link key={s.label} href={s.href}
              className={"flex items-center px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all " + (active(s.href) ? 'bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/5' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200')}>
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
                className={"flex w-full items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all " + (isActive ? 'text-emerald-400' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200')}>
                <span>{s.label}</span>
                <ChevronDown open={isOpen} />
              </button>
              {isOpen && (
                <div id={submenuId} className="border-l border-slate-800/60 ml-[18px] pl-3.5 mt-0.5 space-y-0.5">
                  {s.children.map((c: any) => (
                    <Link key={c.href} href={c.href}
                      className={"block px-3 py-[7px] rounded-lg text-[13px] transition-all " + (active(c.href) ? 'text-emerald-400 font-medium bg-emerald-500/15 shadow-sm shadow-emerald-500/5' : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-200')}>
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-slate-800/80 px-4 py-3.5 flex-shrink-0">
        <div className="text-xs font-medium text-slate-500 truncate mb-2">{userEmail}</div>
        <button onClick={handleLogout} className="text-[13px] font-medium text-slate-500 hover:text-red-400 transition-colors">Log out</button>
      </div>
    </aside>
  )
}
