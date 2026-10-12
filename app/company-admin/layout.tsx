import RoleShell from '@/components/nav/role-shell'
import { companyAdminModules } from '@/lib/navigation/role-modules'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { workspaceMetadata } from '@/lib/tenant/metadata'
import { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/neutral-name';
import { NoCompanyNotice } from '@/components/workspace/no-company-notice'

export const generateMetadata = workspaceMetadata

export default async function CompanyAdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePortfolioAdmin()

  return (
    <RoleShell
      portfolioName={me.portfolio?.company_name ?? me.portfolio?.name ?? NEUTRAL_COMPANY_NAME}
      logoUrl={me.portfolio?.logo_url ?? null}
      brandColor={me.portfolio?.brand_color ?? '#10B981'}
      userEmail={me.email ?? undefined}
      modules={companyAdminModules}
      subtitle="Company admin"
      width="wide"
    >
      {/* Every page here reads and writes one company. An account with no
          company (a platform operator) gets the notice instead of empty pages
          and database errors. */}
      {me.portfolio?.id ? children : <NoCompanyNotice title="Company admin" operator={me.is_platform_operator} />}
    </RoleShell>
  )
}
