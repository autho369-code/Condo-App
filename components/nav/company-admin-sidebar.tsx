'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { companyAdminModules } from '@/lib/navigation/company-admin-modules';
import { createClient } from '@/lib/supabase/client';

export default function CompanyAdminSidebar({
  companyName,
  userEmail,
}: {
  companyName?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const active = (href: string) => {
    const base = href.split('?')[0];
    if (base === '/company-admin') return pathname === '/company-admin';
    return pathname === base || pathname.startsWith(base + '/');
  };

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-[#0B1121]">
      {/* Brand header */}
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="truncate text-sm font-semibold text-white">
          {companyName ?? 'Portier'}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">Company Admin</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {companyAdminModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className={
              'block px-4 py-2 text-sm ' +
              (active(module.href)
                ? 'bg-emerald-500/10 font-medium text-emerald-400 border-r-2 border-emerald-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200')
            }
          >
            {module.label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="mb-1 truncate text-xs text-slate-500">{userEmail}</div>
        <button
          onClick={handleLogout}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
