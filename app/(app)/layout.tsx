import { headers } from 'next/headers';
import Sidebar from '@/components/nav/sidebar';
import { requireAuth } from '@/lib/auth/me';
import { tenantFromHeaders } from '@/lib/tenant/resolve';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAuth();

  // Tenant branding (from subdomain) takes priority over authenticated user's portfolio name
  const h = await headers();
  const tenant = tenantFromHeaders(h);

  const displayName = tenant?.companyName ?? me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier';
  const logoUrl = tenant?.logoUrl ?? me.portfolio?.logo_url ?? null;
  const brandColor = tenant?.brandColor ?? me.portfolio?.brand_color ?? '#10B981';

  return (
    <div className="flex min-h-screen">
      <Sidebar
        portfolioName={displayName}
        logoUrl={logoUrl}
        brandColor={brandColor}
        userEmail={me.email ?? undefined}
      />
      <main className="flex-1 overflow-hidden pt-12 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
