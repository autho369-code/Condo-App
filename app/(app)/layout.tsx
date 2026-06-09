import { headers } from 'next/headers';
import { requireAuth } from '@/lib/auth/me';
import { tenantFromHeaders } from '@/lib/tenant/resolve';
import { CommandNav } from '@/components/command-center/command-nav';
import { CommandBar } from '@/components/command-center/command-bar';
import { OperationsPanel } from '@/components/command-center/operations-panel';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAuth();
  const h = await headers();
  const tenant = tenantFromHeaders(h);
  const displayName = tenant?.companyName ?? me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier369';

  return (
    <div className="flex h-screen bg-[#f5f6f8] overflow-hidden">
      {/* Column 1: Navigation — 240px fixed */}
      <CommandNav portfolioName={displayName} />

      {/* Column 2: Main Content — flexible */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Column 3: Operations Panel — 320px fixed */}
      <OperationsPanel />

      {/* Overlays */}
      <CommandBar />
    </div>
  );
}
