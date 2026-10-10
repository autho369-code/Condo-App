import RoleShell from '@/components/nav/role-shell'
import { vendorModules } from '@/lib/navigation/role-modules'
import { requireVendor } from '@/lib/auth/me'
import { workspaceMetadata } from '@/lib/tenant/metadata'
import { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/neutral-name';

export const generateMetadata = workspaceMetadata

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const me = await requireVendor()
  return (
    <RoleShell
      portfolioName={me.portfolio?.company_name ?? me.portfolio?.name ?? NEUTRAL_COMPANY_NAME}
      userEmail={me.email ?? undefined}
      modules={vendorModules}
      subtitle="Vendor portal"
      brandColor={me.portfolio?.brand_color ?? null}
      width="portal"
    >
      {children}
    </RoleShell>
  )
}
