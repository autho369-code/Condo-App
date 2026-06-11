import Sidebar from '@/components/nav/sidebar'
import { companyAdminModules } from '@/lib/navigation/role-modules'
import { requirePortfolioAdmin } from '@/lib/auth/me'

export default async function CompanyAdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePortfolioAdmin()

  return (
    <div className="flex min-h-screen">
      <Sidebar
        portfolioName={me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier369'}
        logoUrl={me.portfolio?.logo_url ?? null}
        brandColor={me.portfolio?.brand_color ?? '#10B981'}
        userEmail={me.email ?? undefined}
        modules={companyAdminModules}
        subtitle="Company admin"
      />
      <main className="h-screen flex-1 overflow-y-auto bg-[#f6f7f9] pt-12 lg:pt-0">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
