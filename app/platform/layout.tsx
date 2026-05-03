import PlatformSidebar from '@/components/nav/platform-sidebar';
import { requirePlatformOperator } from '@/lib/auth/me';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePlatformOperator();
  return (
    <div className="flex min-h-screen bg-gray-50">
      <PlatformSidebar userEmail={me.email ?? undefined} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
