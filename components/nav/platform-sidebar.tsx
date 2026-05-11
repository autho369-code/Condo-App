'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { platformModules } from '@/lib/navigation/platform-modules';
import { createClient } from '@/lib/supabase/client';
import { PortierLogo } from '@/components/brand/manageops-logo';

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
    <aside className="flex w-full md:h-screen md:w-64 md:flex-shrink-0 flex-col overflow-hidden bg-ink-gradient text-cream-100 order-last md:order-first">
      <div className="border-b border-white/10 px-5 py-5">
        <PortierLogo size="sm" tone="light" />
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-cream-400/80">
            Platform
          </div>
          <div className="mt-1 truncate font-display text-base text-cream-50">
            Operator Console
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {platformModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className={
              'group relative flex items-center rounded-md px-3 py-2 text-[13px] tracking-tight transition-all ' +
              (active(module.href)
                ? 'bg-white/[0.06] text-champagne-200'
                : 'text-cream-200/80 hover:bg-white/[0.04] hover:text-cream-50')
            }
          >
            {active(module.href) && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-champagne-400" />
            )}
            {module.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-champagne-shimmer text-[11px] font-semibold text-ink-900">
            {(userEmail ?? 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] text-cream-100">{userEmail ?? 'Signed in'}</div>
            <button
              onClick={handleLogout}
              className="mt-1 text-[11px] uppercase tracking-[0.14em] text-cream-400/80 hover:text-champagne-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
