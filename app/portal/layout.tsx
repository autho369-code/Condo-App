import Sidebar from '@/components/nav/sidebar'
import { ownerModules } from '@/lib/navigation/role-modules'
import { requireOwner } from '@/lib/auth/me'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOwner()
  return (
    <div className="flex min-h-screen">
      <Sidebar
        portfolioName={me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier369'}
        logoUrl={me.portfolio?.logo_url ?? null}
        userEmail={me.email ?? undefined}
        modules={ownerModules}
        subtitle="Owner portal"
      />
      <main className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#f6f7f9] pt-12 lg:pt-0">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
