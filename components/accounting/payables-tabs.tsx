import Link from 'next/link';

const TABS = [
  { key: 'bills', label: 'Bills', href: '/bills' },
  { key: 'payments', label: 'Payments', href: '/bills?tab=payments' },
  { key: 'recurring', label: 'Recurring', href: '/bills/recurring' },
  { key: 'loans', label: 'Loans', href: '/accounting/loans' },
] as const;

export type PayablesTab = (typeof TABS)[number]['key'];

/**
 * The Payables section's pages, shown across the top of each one. `filters`
 * (association / vendor) carry over between the Bills and Payments lists.
 */
export function PayablesTabs({ current, filters }: { current: PayablesTab; filters?: URLSearchParams }) {
  const extra = filters?.toString() ?? '';
  return (
    <nav aria-label="Payables" className="flex gap-1 overflow-x-auto border-b border-gray-200">
      {TABS.map((t) => {
        const href = extra && (t.key === 'bills' || t.key === 'payments')
          ? `${t.href}${t.href.includes('?') ? '&' : '?'}${extra}`
          : t.href;
        return (
          <Link
            key={t.key}
            href={href}
            aria-current={t.key === current ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${t.key === current ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 transition-colors hover:text-gray-700'}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
