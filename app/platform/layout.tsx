import PlatformSidebar from '@/components/nav/platform-sidebar';
import { requirePlatformOperator } from '@/lib/auth/me';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePlatformOperator();
  return (
    <div className="flex min-h-screen bg-[#060B18]">
      <PlatformSidebar userEmail={me.email ?? undefined} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
