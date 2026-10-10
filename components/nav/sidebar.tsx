'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { openCommandPalette } from '@/components/search/command-palette'
import { appModules, type AppModule } from '@/lib/navigation/modules'
import { createClient } from '@/lib/supabase/client'
import { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/neutral-name';

function matchesPathname(pathname: string, href: string) {
  const path = href.split('?')[0]
  return pathname === path || (path.length > 1 && pathname.startsWith(`${path}/`))
}

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
    <button onClick={onClick} className="lg:hidden print:hidden fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-[10px] bg-white border border-line shadow-sm" aria-label="Toggle menu" aria-expanded={open}>
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

export default function Sidebar({ portfolioName, logoUrl, brandColor, userEmail, modules = appModules, subtitle = 'Operations workspace', showRecordSearch = false }: {
  /** Only the staff workspace mounts the Ctrl+K record search palette. */
  showRecordSearch?: boolean;
  portfolioName?: string;
  logoUrl?: string | null;
  brandColor?: string;
  userEmail?: string;
  modules?: AppModule[];
  subtitle?: string;
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navQuery, setNavQuery] = useState('')

  const defaults: Record<string, boolean> = {}
  modules.forEach((s) => {
    if (s.children) defaults[s.label] = s.children.some((i) => matchesPathname(pathname, i.href))
  })
  const [open, setOpen] = useState<Record<string, boolean>>(defaults)

  useEffect(() => {
    setOpen(prev => {
      const next = { ...prev }
      modules.forEach((s) => {
        if (s.children && s.children.some((i) => matchesPathname(pathname, i.href))) {
          next[s.label] = true
        }
      })
      return next
    })
    // Close mobile menu on navigation
    setMobileOpen(false)
  }, [pathname, modules])

  const toggle = (label: string) => setOpen(p => ({ ...p, [label]: !p[label] }))
  const activeHref = useMemo(() => {
    const hrefs = modules.flatMap((module) => [module.href, ...(module.children?.map((child) => child.href) ?? [])])
    const current = new URLSearchParams(searchKey)
    return hrefs
      .map((href) => {
        const [path, query = ''] = href.split('?')
        const required = new URLSearchParams(query)
        const queryMatches = Array.from(required.entries()).every(([key, value]) => current.get(key) === value)
        return { href, path, queryMatches, querySpecificity: Array.from(required.keys()).length }
      })
      .filter(({ href, queryMatches }) => matchesPathname(pathname, href) && queryMatches)
      .sort((a, b) => (b.path.length - a.path.length) || (b.querySpecificity - a.querySpecificity))[0]?.href
  }, [modules, pathname, searchKey])
  const active = (href: string) => href === activeHref

  const visibleModules = useMemo(() => {
    const query = navQuery.trim().toLowerCase()
    if (!query) return modules
    return modules.flatMap((module) => {
      if (module.label.toLowerCase().includes(query)) return [module]
      const children = module.children?.filter((child) => child.label.toLowerCase().includes(query)) ?? []
      return children.length ? [{ ...module, children }] : []
    })
  }, [modules, navQuery])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // The offline copy of the violation field page holds this user's associations and units.
    try { if ('caches' in window) await caches.delete('portier-field-v1') } catch {}
    router.push('/login')
  }

  // Readable on the dark rail: 14px items, light-gray idle text, and the
  // company's color marking the current page.
  const itemBase =
    'relative flex items-center h-9 px-3 mx-2 rounded-lg text-[14px] font-medium transition-colors duration-100'
  const itemIdle = 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-white/[0.05]'
  const activeMark = 'before:absolute before:-left-2 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r before:bg-accent'
  const itemActive = 'bg-[#16161a] text-[#f4f4f5] ' + activeMark

  const sidebarContent = (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#060709]">
      {/* Workspace header */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant logos live on arbitrary customer hosts; next/image would need every host allow-listed
          <img src={logoUrl} alt={portfolioName ?? 'Portal'} className="mb-1 h-8 object-contain" />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent font-display text-[14px] font-bold text-accent-ink">
              {(portfolioName ?? 'P').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-[14px] font-semibold tracking-[-0.01em] text-[#f4f4f5]" title={portfolioName ?? NEUTRAL_COMPANY_NAME}>
                {portfolioName ?? NEUTRAL_COMPANY_NAME}
              </div>
              <div className="text-[12px] leading-4 text-[#8a8a93]">{subtitle}</div>
            </div>
          </div>
        )}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#52525b]" />
          <input
            type="search"
            value={navQuery}
            onChange={(event) => setNavQuery(event.target.value)}
            placeholder="Find a workspace"
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-2 text-[13px] text-[#e4e4e7] outline-none placeholder:text-[#71717a] focus:border-white/[0.18] focus:bg-white/[0.06] focus:ring-1 focus:ring-white/[0.08]"
            aria-label="Filter navigation"
            aria-controls="workspace-navigation"
          />
        </div>
        {showRecordSearch && <button
          type="button"
          onClick={openCommandPalette}
          className="mt-1.5 flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-[13px] text-[#a1a1aa] transition-colors hover:bg-white/[0.05] hover:text-[#f4f4f5]"
        >
          <span>Search records</span>
          <kbd className="rounded border border-white/[0.1] px-1.5 font-sans text-[12.5px] text-[#8a8a93]">Ctrl K</kbd>
        </button>}
      </div>

      <div className="sr-only" aria-live="polite">
        {navQuery ? `${visibleModules.reduce((count, module) => count + (module.children?.length ?? 1), 0)} navigation results` : ''}
      </div>
      <nav id="workspace-navigation" className="flex-1 overflow-y-auto py-3 [scrollbar-width:thin] [scrollbar-color:#27272a_transparent]">
        {visibleModules.map((s, index) => {
          const previousGroup = visibleModules[index - 1]?.group
          const showGroup = Boolean(s.group && s.group !== previousGroup)
          const item = (() => {
          if (s.accent) return (
            <Link key={s.label} href={s.href}
              className={
                'my-1.5 flex h-9 items-center justify-center px-3 mx-2 rounded-lg text-[14px] font-semibold transition-colors duration-100 ' +
                (active(s.href)
                  ? 'bg-white text-gray-950'
                  : 'bg-white/[0.92] text-gray-950 hover:bg-white')
              }
              aria-current={active(s.href) ? 'page' : undefined}>
              {s.label}
            </Link>
          )
          if (!s.children) return (
            <Link key={s.label} href={s.href}
              className={itemBase + ' ' + (active(s.href) ? itemActive : itemIdle)}
              aria-current={active(s.href) ? 'page' : undefined}>
              {s.label}
            </Link>
          )
          const isOpen = navQuery ? true : open[s.label]
          const isActive = s.children.some((i: any) => active(i.href))
          const submenuId = `sidebar-submenu-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
          return (
            <div key={s.label}>
              <button onClick={() => toggle(s.label)}
                aria-expanded={!!isOpen}
                aria-controls={submenuId}
                className={itemBase + ' w-[calc(100%-16px)] justify-between ' + (isActive && !isOpen ? itemActive : itemIdle)}>
                <span>{s.label}</span>
                <span className={isOpen ? 'text-[#a1a1aa]' : 'text-[#71717a]'}>
                  <ChevronDown open={!!isOpen} />
                </span>
              </button>
              {isOpen && (
                <div id={submenuId} className="relative my-0.5 ml-[22px] border-l border-white/[0.08] pl-1">
                  {s.children.map((c: any) => (
                    <Link key={c.href} href={c.href}
                      aria-current={active(c.href) ? 'page' : undefined}
                      className={
                        'flex min-h-8 items-center rounded-md px-3 py-1 text-[13.5px] leading-5 transition-colors duration-100 ' +
                        (active(c.href)
                          ? 'bg-[#16161a] font-medium text-[#f4f4f5]'
                          : 'text-[#a1a1aa] hover:bg-white/[0.05] hover:text-[#f4f4f5]')
                      }>
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
          })()
          return (
            <div key={s.label}>
              {showGroup ? (
                <div className={`px-5 pb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[#71717a] ${index === 0 ? 'pt-1' : 'pt-5'}`}>
                  {s.group}
                </div>
              ) : null}
              {item}
            </div>
          )
        })}
        {visibleModules.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] leading-5 text-[#8a8a93]">
            No workspace matches &quot;{navQuery}&quot;.
          </div>
        ) : null}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[12px] font-medium uppercase text-[#d4d4d8]">
            {(userEmail ?? '?').charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-[#e4e4e7]" title={userEmail}>{userEmail}</div>
            <div className="flex items-center gap-2 text-[12.5px] text-[#a1a1aa]">
              <Link href="/account" className="py-1 transition-colors hover:text-[#f4f4f5]">
                Account
              </Link>
              <span className="text-[#52525b]">·</span>
              <button onClick={handleLogout} className="py-1 transition-colors hover:text-[#f4f4f5]">
                Log out
              </button>
            </div>
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
      {/* Desktop: always visible. Mobile: slide in when open. Hidden when printing. */}
      <div className={`fixed lg:static lg:shrink-0 inset-y-0 left-0 z-40 transition-transform duration-200 print:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {sidebarContent}
      </div>
    </>
  )
}
