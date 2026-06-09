import { headers } from 'next/headers';
import { requireAuth } from '@/lib/auth/me';
import { tenantFromHeaders } from '@/lib/tenant/resolve';
import { CommandNav } from '@/components/command-center/command-nav';
import { ManagerSidebar } from '@/components/command-center/manager-sidebar';
import { CommandBar } from '@/components/command-center/command-bar';
import { QuickActions } from '@/components/command-center/quick-actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAuth();
  const h = await headers();
  const tenant = tenantFromHeaders(h);

  const displayName = tenant?.companyName ?? me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier369';
  const logoUrl = tenant?.logoUrl ?? me.portfolio?.logo_url ?? null;
  const brandColor = tenant?.brandColor ?? me.portfolio?.brand_color ?? '#10B981';

  return (
    <div className="flex h-screen bg-[#0a0b0d] overflow-hidden">
      {/* Left: Workspace Navigation */}
      <CommandNav portfolioName={displayName} />

      {/* Center: Command Center / Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Right: Insights Panel */}
      <ManagerSidebar />

      {/* Global Overlays */}
      <CommandBar />
      <QuickActions />
    </div>
  );
}
