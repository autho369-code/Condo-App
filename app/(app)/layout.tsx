import Sidebar from '@/components/nav/sidebar';
import { requireStaff } from '@/lib/auth/me';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  return (
    <div className="flex min-h-screen">
      <Sidebar portfolioName={me.portfolio?.company_name ?? me.portfolio?.name ?? 'Portier'} userEmail={me.email ?? undefined} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
