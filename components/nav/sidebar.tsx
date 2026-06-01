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
    <aside className="flex h-screen w-52 flex-shrink-0 flex-col border-r border-slate-800 bg-[#0B1121] overflow-hidden">
      <div className="border-b border-slate-800 px-4 py-3 flex-shrink-0">
        <div className="text-sm font-semibold text-white truncate">{portfolioName ?? 'Portier'}</div>
        <div className="text-xs text-slate-400 mt-0.5">Operations workspace</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        {appModules.map((s) => {
          if (!s.children) return (
            <Link key={s.label} href={s.href}
              className={"flex items-center px-4 py-2 text-sm " + (active(s.href) ? 'bg-emerald-500/20 text-emerald-400 font-medium border-r-2 border-emerald-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200')}>
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
                className={"flex w-full items-center justify-between px-4 py-2 text-sm " + (isActive ? 'text-emerald-400 font-medium' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200')}>
                <span>{s.label}</span>
                <ChevronDown open={isOpen} />
              </button>
              {isOpen && (
                <div id={submenuId} className="border-l-2 border-slate-700 ml-4 bg-[#060B18]">
                  {s.children.map((c: any) => (
                    <Link key={c.href} href={c.href}
                      className={"block px-4 py-1.5 text-sm " + (active(c.href) ? 'text-emerald-400 font-medium bg-emerald-500/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200')}>
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 px-4 py-3 flex-shrink-0">
        <div className="text-xs text-slate-400 truncate mb-1">{userEmail}</div>
        <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-300">Log out</button>
      </div>
    </aside>
  )
}
