import Sidebar from '@/components/nav/sidebar';
import { AppHeader } from '@/components/nav/app-header';
import { requireAuth } from '@/lib/auth/me';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <div className="flex h-screen min-h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
