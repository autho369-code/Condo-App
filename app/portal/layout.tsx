import Sidebar from '@/components/nav/sidebar';
import { requireOwnerPortal } from '@/lib/auth/me';
import { currentTenant } from '@/lib/tenant/server';
import { TenantFooter } from '@/components/brand/tenant-footer';
import { portalModules } from '@/lib/navigation/modules';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOwnerPortal();
  const tenant = await currentTenant();

  // Prefer tenant-from-URL (when reached via subdomain) over me.portfolio
  const portfolioName =
    tenant?.company_name ??
    me.portfolio?.company_name ??
    me.portfolio?.name ??
    'Resident Portal';

  return (
    <div className="flex min-h-screen flex-col bg-cream-50 md:flex-row">
      <Sidebar
        portfolioName={portfolioName}
        userEmail={me.email ?? undefined}
        modules={portalModules}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
        <TenantFooter tenant={tenant} />
      </main>
    </div>
  );
}
