import RoleShell from '@/components/nav/role-shell';
import { requireTenant } from '@/lib/auth/me';
import { residentModules } from '@/lib/navigation/role-modules';
import { workspaceMetadata } from '@/lib/tenant/metadata';
import { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/neutral-name';

export const generateMetadata = workspaceMetadata;

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTenant();
  return (
    <RoleShell
      portfolioName={me.portfolio?.company_name ?? me.portfolio?.name ?? NEUTRAL_COMPANY_NAME}
      logoUrl={me.portfolio?.logo_url ?? null}
      brandColor={me.portfolio?.brand_color ?? undefined}
      userEmail={me.email ?? undefined}
      modules={residentModules}
      subtitle="Resident portal"
      width="portal"
    >
      {children}
    </RoleShell>
  );
}
