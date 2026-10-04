import Link from 'next/link';

const TABS = [
  { key: 'performance', label: 'Performance', href: '/metrics' },
  { key: 'pricing', label: 'Pricing Metrics', href: '/metrics/pricing' },
  { key: 'business', label: 'Business Metrics', href: '/metrics/business' },
  { key: 'diagnostics', label: 'Data Diagnostic', href: '/metrics/diagnostics' },
] as const;

export type MetricsTab = (typeof TABS)[number]['key'];

/** The Metrics pages, shown under the Reporting tabs. */
export function MetricsTabs({ current }: { current: MetricsTab }) {
  return (
    <nav aria-label="Metrics" className="mb-5 flex gap-1 overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? 'page' : undefined}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${t.key === current ? 'bg-gray-950 text-white' : 'text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700'}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
