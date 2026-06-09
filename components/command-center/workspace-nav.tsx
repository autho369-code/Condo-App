'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const WORKSPACES = {
  OPERATIONS: {
    label: 'Operations',
    icon: '⚡',
    items: [
      { label: 'Work Orders', href: '/work-orders' },
      { label: 'Maintenance Calendar', href: '/calendar' },
      { label: 'Inspections', href: '/inspections' },
      { label: 'Capital Projects', href: '/projects' },
      { label: 'Unit Turns', href: '/unit-turns' },
      { label: 'Purchase Orders', href: '/purchase-orders' },
      { label: 'Inventory', href: '/inventory' },
      { label: 'Fixed Assets', href: '/fixed-assets' },
    ],
  },
  FINANCIAL: {
    label: 'Financial',
    icon: '$',
    items: [
      { label: 'Assessments', href: '/charges' },
      { label: 'Accounts Payable', href: '/bills' },
      { label: 'Bank Accounts', href: '/bank-accounts' },
      { label: 'Bank Transfers', href: '/bank-transfers' },
      { label: 'GL Accounts', href: '/gl-accounts' },
      { label: 'Journal Entries', href: '/journal-entries' },
      { label: 'Budgets', href: '/budget' },
      { label: 'Budget vs Actuals', href: '/budget-vs-actuals' },
      { label: 'Reports', href: '/reports' },
      { label: '1099 Reporting', href: '/accounting/1099' },
      { label: 'Diagnostics', href: '/diagnostics' },
    ],
  },
  RESIDENTS: {
    label: 'Residents',
    icon: '👥',
    items: [
      { label: 'Owners', href: '/owners' },
      { label: 'Units', href: '/units' },
      { label: 'Associations', href: '/associations' },
    ],
  },
  COMPLIANCE: {
    label: 'Compliance',
    icon: '🛡️',
    items: [
      { label: 'Violations', href: '/violations' },
      { label: 'Insurance Tracking', href: '/insurance' },
      { label: 'Documents', href: '/documents' },
    ],
  },
  VENDORS: {
    label: 'Vendors',
    icon: '🏗️',
    items: [
      { label: 'Vendors', href: '/vendors' },
      { label: 'Work Orders', href: '/work-orders' },
      { label: 'Purchase Orders', href: '/purchase-orders' },
    ],
  },
} as const;

type WorkspaceKey = keyof typeof WORKSPACES;

export function WorkspaceNav({ portfolioName, userEmail }: { portfolioName: string; userEmail?: string }) {
  const pathname = usePathname();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceKey | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const isDashboard = pathname === '/dashboard';

  return (
    <div className={`flex flex-col h-full bg-[#0a0b0d] border-r border-[#1a1b1e] transition-all ${collapsed ? 'w-[56px]' : 'w-[240px]'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[#1a1b1e]">
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[#e4e4e7] truncate">{portfolioName}</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#18181b] text-xs"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Command Center home */}
      <Link
        href="/dashboard"
        className={`flex items-center gap-3 mx-2 mt-2 px-3 h-9 rounded-lg text-sm transition-colors ${
          isDashboard
            ? 'bg-[#18181b] text-[#e4e4e7] font-medium'
            : 'text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#18181b]'
        }`}
      >
        <span className="text-base flex-shrink-0">⌂</span>
        {!collapsed && <span>Command Center</span>}
      </Link>

      {/* Workspaces */}
      <div className="flex-1 overflow-y-auto mt-3 px-2">
        {(Object.keys(WORKSPACES) as WorkspaceKey[]).map((key) => {
          const ws = WORKSPACES[key];
          const isActive = activeWorkspace === key;
          const hasActiveChild = ws.items.some((item) => pathname.startsWith(item.href));

          return (
            <div key={key} className="mb-0.5">
              <button
                onClick={() => setActiveWorkspace(isActive ? null : key)}
                className={`flex items-center gap-3 w-full px-3 h-9 rounded-lg text-sm transition-colors ${
                  hasActiveChild
                    ? 'text-[#e4e4e7] bg-[#18181b]'
                    : 'text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#18181b]'
                }`}
              >
                <span className="text-base flex-shrink-0 w-5 text-center">{ws.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left font-medium">{ws.label}</span>
                    <span className={`text-[10px] transition-transform ${isActive ? 'rotate-90' : ''}`}>▶</span>
                  </>
                )}
              </button>

              {isActive && !collapsed && (
                <div className="ml-9 mt-0.5 mb-1 border-l border-[#1a1b1e]">
                  {ws.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block px-3 py-1.5 text-[13px] rounded-r-lg transition-colors ${
                        pathname === item.href
                          ? 'text-[#e4e4e7] bg-[#18181b] font-medium'
                          : 'text-[#71717a] hover:text-[#d4d4d8] hover:bg-[#18181b]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-[#1a1b1e] px-2 py-3 space-y-1">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 h-8 rounded-lg text-sm text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#18181b] transition-colors ${
            pathname.startsWith('/settings') ? 'text-[#e4e4e7] bg-[#18181b]' : ''
          }`}
        >
          <span className="text-sm flex-shrink-0">⚙</span>
          {!collapsed && <span>Settings</span>}
        </Link>
        {!collapsed && userEmail && (
          <div className="px-3 pt-2 text-[11px] text-[#52525b] truncate">{userEmail}</div>
        )}
      </div>
    </div>
  );
}
