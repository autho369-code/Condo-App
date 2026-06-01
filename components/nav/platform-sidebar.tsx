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
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-[#0B1121]">
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="truncate text-sm font-semibold text-white">Portier Admin</div>
        <div className="mt-0.5 text-xs text-slate-400">Platform operator</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {platformModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className={
              'block px-4 py-2 text-sm ' +
              (active(module.href)
                ? 'bg-emerald-500/20 font-medium text-emerald-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200')
            }
          >
            {module.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-4 py-3">
        <div className="mb-1 truncate text-xs text-slate-400">{userEmail}</div>
        <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-300">
          Log out
        </button>
      </div>
    </aside>
  );
}
