import PlatformSidebar from '@/components/nav/platform-sidebar';
import { ManagerCommandPalette } from '@/components/command/manager-command-palette';
import { requirePlatformOperator } from '@/lib/auth/me';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePlatformOperator();
  return (
    <div className="flex min-h-screen bg-cream-50">
      <PlatformSidebar userEmail={me.email ?? undefined} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-10 py-10">{children}</div>
      </main>
      <ManagerCommandPalette />
    </div>
  );
}
