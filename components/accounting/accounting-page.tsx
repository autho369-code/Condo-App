import Link from 'next/link';
import * as React from 'react';

const ACCOUNTING_TABS = [
  { label: 'Receivables', href: '/charges', key: 'receivables' },
  { label: 'Payables', href: '/bills', key: 'payables' },
  { label: 'Bank Accounts', href: '/bank-accounts', key: 'bank-accounts' },
  { label: 'Journal Entries', href: '/journal-entries', key: 'journal-entries' },
  { label: 'Bank Transfers', href: '/bank-transfers', key: 'bank-transfers' },
  { label: 'GL Accounts', href: '/gl-accounts', key: 'gl-accounts' },
  { label: 'Diagnostics', href: '/diagnostics', key: 'diagnostics' },
];

export function AccountingPage({
  active,
  title,
  children,
  subtabs,
}: {
  active: string;
  title: string;
  children: React.ReactNode;
  subtabs?: Array<{ label: string; href: string; active?: boolean }>;
}) {
  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <div className="mx-auto max-w-5xl space-y-5">
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          {ACCOUNTING_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={
                tab.key === active
                  ? 'border-b border-brand-600 pb-1 font-medium text-brand-700'
                  : 'pb-1 text-ink-700 hover:text-brand-700'
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {subtabs && subtabs.length > 0 && (
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {subtabs.map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                className={
                  tab.active
                    ? 'border-b border-brand-600 pb-1 font-medium text-brand-700'
                    : 'pb-1 text-ink-700 hover:text-brand-700'
                }
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}

        <h1 className="text-xl font-medium text-ink-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function AccountingSearchBox({
  children = 'Click here to search',
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-brand-500 bg-white px-4 py-3 text-center text-xs text-ink-700">
      {children}
    </div>
  );
}

export function AccountingEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">
      {children}
    </p>
  );
}
