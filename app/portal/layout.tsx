import RoleShell from '@/components/nav/role-shell'
import { ownerModules } from '@/lib/navigation/role-modules'
import { requireOwner } from '@/lib/auth/me'
import { workspaceMetadata } from '@/lib/tenant/metadata'
import { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/neutral-name';

export const generateMetadata = workspaceMetadata

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOwner()
  // Owners who sit on the board get both portals on one login.
  const modules = me.is_board
    ? [ownerModules[0], { label: 'Board Portal', href: '/board' }, ...ownerModules.slice(1)]
    : ownerModules
  return (
    <RoleShell
      portfolioName={me.portfolio?.company_name ?? me.portfolio?.name ?? NEUTRAL_COMPANY_NAME}
      logoUrl={me.portfolio?.logo_url ?? null}
      userEmail={me.email ?? undefined}
      modules={modules}
      subtitle="Owner portal"
      brandColor={me.portfolio?.brand_color ?? null}
      width="portal"
    >
      {children}
    </RoleShell>
  )
}
