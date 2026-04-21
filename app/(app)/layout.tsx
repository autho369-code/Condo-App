import Sidebar from '@/components/nav/sidebar';
import { requireAuth } from '@/lib/auth/me';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* Children own their own layout: either the three-column Workspace shell
          (/dashboard, /reports, /work-orders, /units, /bills) OR a padded single
          column (everything else). Padded pages wrap themselves in
          `<div className="mx-auto max-w-7xl px-6 py-8">…</div>`. */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
