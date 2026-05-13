'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { appModules } from '@/lib/navigation/modules'
import type { AppModule } from '@/lib/navigation/modules'
import { createClient } from '@/lib/supabase/client'
import { PortierLogo } from '@/components/brand/manageops-logo'

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Sidebar({
  portfolioName,
  userEmail,
  modules = appModules,
}: {
  portfolioName?: string
  userEmail?: string
  modules?: AppModule[]
}) {
  const pathname = usePathname()
  const router = useRouter()

  const defaults: Record<string, boolean> = {}
  modules.forEach((s) => {
    if (s.children) defaults[s.label] = s.children.some((i) => pathname.startsWith(i.href.split('?')[0]))
  })
  const [open, setOpen] = useState<Record<string, boolean>>(defaults)

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev }
      modules.forEach((s) => {
        if (s.children && s.children.some((i) => pathname.startsWith(i.href.split('?')[0]))) {
          next[s.label] = true
        }
      })
      return next
    })
  }, [modules, pathname])

  const toggle = (label: string) => setOpen((p) => ({ ...p, [label]: !p[label] }))
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
    <aside className="flex w-full md:h-screen md:w-64 md:flex-shrink-0 flex-col overflow-hidden bg-ink-gradient text-cream-100 order-last md:order-first">
      {/* Brand block */}
      <div className="flex-shrink-0 border-b border-white/10 px-5 py-5">
        <PortierLogo size="sm" tone="light" />
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-cream-400/80">
            Portfolio
          </div>
          <div className="mt-1 truncate font-display text-base text-cream-50">
            {portfolioName ?? 'Portier'}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {modules.map((s) => {
          if (!s.children)
            return (
              <Link
                key={s.label}
                href={s.href}
                className={
                  'group relative flex items-center rounded-md px-3 py-2 text-[13px] tracking-tight transition-all ' +
                  (active(s.href)
                    ? 'bg-white/[0.06] text-champagne-200'
                    : 'text-cream-200/80 hover:bg-white/[0.04] hover:text-cream-50')
                }
              >
                {active(s.href) && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-champagne-400" />
                )}
                {s.label}
              </Link>
            )
          const isOpen = open[s.label]
          const isActive = s.children.some((i: any) => active(i.href))
          const submenuId = `sidebar-submenu-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
          return (
            <div key={s.label} className="mb-0.5">
              <button
                onClick={() => toggle(s.label)}
                aria-expanded={!!isOpen}
                aria-controls={submenuId}
                className={
                  'group relative flex w-full items-center justify-between rounded-md px-3 py-2 text-[13px] tracking-tight transition-all ' +
                  (isActive
                    ? 'text-champagne-200'
                    : 'text-cream-200/80 hover:bg-white/[0.04] hover:text-cream-50')
                }
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-champagne-400" />
                )}
                <span>{s.label}</span>
                <ChevronDown open={isOpen} />
              </button>
              {isOpen && (
                <div id={submenuId} className="ml-3 mt-0.5 mb-1 border-l border-white/10 pl-2">
                  {s.children.map((c: any) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className={
                        'block rounded-md px-3 py-1.5 text-[12.5px] transition-colors ' +
                        (active(c.href)
                          ? 'bg-white/[0.06] text-champagne-200 font-medium'
                          : 'text-cream-200/60 hover:text-cream-100')
                      }
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer / user */}
      <div className="flex-shrink-0 border-t border-white/10 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-champagne-shimmer text-[11px] font-semibold text-ink-900">
            {(userEmail ?? 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] text-cream-100">{userEmail ?? 'Signed in'}</div>
            <button
              onClick={handleLogout}
              className="mt-1 text-[11px] uppercase tracking-[0.14em] text-cream-400/80 hover:text-champagne-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
