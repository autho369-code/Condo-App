import Link from 'next/link';

const TABS = [
  { key: 'reports', label: 'Reports', href: '/reports' },
  { key: 'scheduled', label: 'Scheduled Reports', href: '/scheduled-reports' },
  { key: 'metrics', label: 'Metrics', href: '/metrics' },
  { key: 'surveys', label: 'Surveys', href: '/surveys' },
  { key: 'compliance', label: 'Compliance', href: '/compliance' },
] as const;

export type ReportingTab = (typeof TABS)[number]['key'];

/** The Reporting section's pages, shown across the top of each one. */
export function ReportingTabs({ current }: { current: ReportingTab }) {
  return (
    <nav aria-label="Reporting" className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? 'page' : undefined}
          className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${t.key === current ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 transition-colors hover:text-gray-700'}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
