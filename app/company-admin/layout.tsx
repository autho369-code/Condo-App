import { requirePortfolioAdmin } from '@/lib/auth/me'
import CompanyAdminSidebar from '@/components/nav/company-admin-sidebar'

export default async function CompanyAdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePortfolioAdmin()

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#060B18' }}>
      <CompanyAdminSidebar me={me} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
      </main>
    </div>
  )
}
