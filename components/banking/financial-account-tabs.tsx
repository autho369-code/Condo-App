import Link from 'next/link';

// Bank accounts and credit card accounts are two tabs of Financial Accounts.
const TABS = [
  { key: 'bank', label: 'Bank Accounts', href: '/bank-accounts' },
  { key: 'card', label: 'Credit Card Accounts', href: '/credit-cards' },
] as const;

export function FinancialAccountTabs({ active }: { active: 'bank' | 'card' }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            t.key === active ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
