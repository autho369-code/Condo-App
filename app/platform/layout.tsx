import Sidebar from '@/components/nav/sidebar';
import { requirePlatformOperator } from '@/lib/auth/me';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformOperator();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
