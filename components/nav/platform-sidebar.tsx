'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { platformModules } from '@/lib/navigation/platform-modules';
import { createClient } from '@/lib/supabase/client';

export default function PlatformSidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const active = (href: string) => {
    const base = href.split('?')[0];
    return pathname === base || (base.length > 1 && pathname.startsWith(base));
  };

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="truncate text-sm font-semibold text-gray-950">Portier Admin</div>
        <div className="mt-0.5 text-xs text-gray-400">Platform operator</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {platformModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className={
              'block px-4 py-2 text-sm ' +
              (active(module.href)
                ? 'bg-blue-50 font-medium text-blue-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950')
            }
          >
            {module.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-gray-200 px-4 py-3">
        <div className="mb-1 truncate text-xs text-gray-500">{userEmail}</div>
        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-700">
          Log out
        </button>
      </div>
    </aside>
  );
}
