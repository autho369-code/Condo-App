// Sidebar — matches AppFolio's top-level module tree (schematic section 2).
// Tier-aware: platform operator, staff, finance, full-access, resident, board, vendor.
import Link from 'next/link';
import { getMe } from '@/lib/auth/me';
import { logout } from '@/lib/auth/actions';

type Item = { href: string; label: string };
type Group = { label: string; items: Item[] };

export default async function Sidebar() {
  const me = await getMe();
  const sections: Group[] = [];

  // ------------------------------------------------------------------
  // Platform operator
  // ------------------------------------------------------------------
  if (me.is_platform_operator) {
    sections.push({
      label: 'Platform',
      items: [
        { href: '/platform/portfolios', label: 'Portfolios' },
        { href: '/platform/operators',  label: 'Operators' },
      ],
    });
  }

  // ------------------------------------------------------------------
  // Staff — matches AppFolio's module tree
  // ------------------------------------------------------------------
  if (me.is_staff) {
    // Top-level nav — each item is its own row without a section header
    sections.push({
      label: '',
      items: [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/calendar',  label: 'Calendar' },
      ],
    });

    sections.push({
      label: 'Property',
      items: [
        { href: '/associations', label: 'Associations' },
        { href: '/units',        label: 'Units' },
      ],
    });

    sections.push({
      label: 'People',
      items: [
        { href: '/owners',               label: 'Owners' },
        { href: '/owners?view=tenants',  label: 'Tenants' },
        { href: '/vendors',              label: 'Vendors' },
      ],
    });

    if (me.is_finance_staff) {
      sections.push({
        label: 'Accounting',
        items: [
          { href: '/charges',           label: 'Receivables' },
          { href: '/bills',             label: 'Payables' },
          { href: '/bank-accounts',     label: 'Bank Accounts' },
          { href: '/journal-entries',   label: 'Journal Entries' },
          { href: '/bank-transfers',    label: 'Bank Transfers' },
          { href: '/gl-accounts',       label: 'GL Accounts' },
          { href: '/diagnostics',       label: 'Diagnostics' },
          { href: '/charge-categories', label: 'Charge Categories' },
        ],
      });
    }

    sections.push({
      label: 'Maintenance',
      items: [
        { href: '/work-orders',            label: 'Work Orders' },
        { href: '/recurring-work-orders',  label: 'Recurring Work Orders' },
        { href: '/inspections',            label: 'Inspections' },
        { href: '/unit-turns',             label: 'Unit Turns' },
        { href: '/projects',               label: 'Projects' },
        { href: '/purchase-orders',        label: 'Purchase Orders' },
        { href: '/inventory',              label: 'Inventory' },
        { href: '/fixed-assets',           label: 'Fixed Assets' },
      ],
    });

    sections.push({
      label: 'Reporting',
      items: [
        { href: '/reports',           label: 'Reports' },
        { href: '/scheduled-reports', label: 'Scheduled Reports' },
        { href: '/metrics',           label: 'Metrics' },
        { href: '/surveys',           label: 'Surveys' },
        { href: '/compliance',        label: 'Compliance / Violations' },
      ],
    });

    sections.push({
      label: 'Communication',
      items: [
        { href: '/letters', label: 'Letters' },
        { href: '/forms',   label: 'Forms' },
        { href: '/inbox',   label: 'Inbox' },
      ],
    });

    if (me.is_full_access_staff) {
      sections.push({
        label: 'Settings',
        items: [
          { href: '/settings', label: 'Settings' },
        ],
      });
    }
  }

  // ------------------------------------------------------------------
  // Portal users (owner / board)
  // ------------------------------------------------------------------
  if (me.is_resident || me.is_board) {
    sections.push({
      label: 'My Portal',
      items: [
        { href: '/portal',                  label: 'Overview' },
        { href: '/portal/ledger',           label: 'Ledger' },
        { href: '/portal/pay',              label: 'Pay Assessment' },
        { href: '/portal/service-requests', label: 'Service Requests' },
        { href: '/portal/autopay',          label: 'Autopay' },
      ],
    });
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="text-sm font-semibold text-gray-900">{me.portfolio?.company_name ?? 'condo-app'}</div>
        <div className="mt-0.5 text-xs text-gray-500">
          {me.role_name ?? (me.is_platform_operator ? 'Platform operator' : me.is_board ? 'Board member' : me.is_resident ? 'Owner' : 'User')}
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {sections.map((s, idx) => (
          <div key={s.label || `section-${idx}`}>
            {s.label && (
              <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.label}</div>
            )}
            <ul className="space-y-0.5">
              {s.items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} className="block rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <form action={logout} className="border-t border-gray-200 p-3">
        <div className="mb-2 truncate text-xs text-gray-500">{me.email}</div>
        <button type="submit" className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Log out
        </button>
      </form>
    </aside>
  );
}
