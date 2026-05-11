'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  { href: '/settings/branding', label: 'Brand identity' },
  { href: '/settings',          label: 'Policy & fees', exact: true },
  // Future: { href: '/settings/team', label: 'Team & invites' },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-2">
      {SECTIONS.map((s) => {
        const active = s.exact ? pathname === s.href : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            role="tab"
            aria-selected={active}
            className={
              'inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition-all ' +
              (active
                ? 'border-ink-900 bg-ink-900 text-cream-50 shadow-soft-sm'
                : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-cream-50')
            }
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
