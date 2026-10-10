import RoleShell from '@/components/nav/role-shell'
import { platformOperatorModules } from '@/lib/navigation/role-modules'
import { requirePlatformOperator } from '@/lib/auth/me'

export default async function PlatformOperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const me = await requirePlatformOperator()

  return (
    <RoleShell
      portfolioName="Portier369"
      userEmail={me.email ?? undefined}
      modules={platformOperatorModules}
      subtitle="Platform operations"
      width="wide"
    >
      {children}
    </RoleShell>
  )
}
