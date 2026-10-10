import RoleShell from '@/components/nav/role-shell'
import { companyAdminModules } from '@/lib/navigation/role-modules'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { workspaceMetadata } from '@/lib/tenant/metadata'
import { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/neutral-name';

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
      {children}
    </RoleShell>
  )
}
