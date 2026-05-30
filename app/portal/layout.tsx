import PortalSidebar from '@/components/nav/portal-sidebar';
import { requireAuth } from '@/lib/auth/me';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAuth();
  return (
    <div className="flex min-h-screen">
      <PortalSidebar portfolioName={me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier'} userEmail={me.email ?? undefined} />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
