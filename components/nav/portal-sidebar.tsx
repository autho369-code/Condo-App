'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { portalModules } from '@/lib/navigation/portal-modules'
import { createClient } from '@/lib/supabase/client'

export default function PortalSidebar({ portfolioName, userEmail }: { portfolioName?: string; userEmail?: string }) {
  const pathname = usePathname()
  const router = useRouter()

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
        <div className="text-sm font-semibold text-gray-900 truncate">{portfolioName ?? 'Portier'}</div>
        <div className="text-xs text-gray-400 mt-0.5">Owner Portal</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        {portalModules.map((m) => (
          <Link key={m.href} href={m.href}
            className={"flex items-center px-4 py-2 text-sm " + (active(m.href) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50')}>
            {m.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="text-xs text-gray-500 truncate mb-1">{userEmail}</div>
        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">Log out</button>
      </div>
    </aside>
  )
}
