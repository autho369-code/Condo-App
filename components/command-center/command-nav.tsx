'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavSection = {
  label: string;
  icon: string;
  items: { label: string; href: string; badge?: number }[];
};

const NAV: NavSection[] = [
  {
    label: 'Portfolio',
    icon: '◉',
    items: [
      { label: 'Command Center', href: '/dashboard' },
      { label: 'Calendar', href: '/calendar' },
      { label: 'Metrics', href: '/metrics' },
    ],
  },
  {
    label: 'Associations',
    icon: '◆',
    items: [
      { label: 'All Associations', href: '/associations' },
      { label: 'Units', href: '/units' },
      { label: 'Buildings', href: '/buildings' },
    ],
  },
  {
    label: 'Owners & Residents',
    icon: '◇',
    items: [
      { label: 'Owners', href: '/owners' },
    ],
  },
  {
    label: 'Work Orders',
    icon: '○',
    items: [
      { label: 'All Work Orders', href: '/work-orders' },
      { label: 'Recurring', href: '/recurring-work-orders' },
      { label: 'Inspections', href: '/inspections' },
      { label: 'Unit Turns', href: '/unit-turns' },
      { label: 'Projects', href: '/projects' },
      { label: 'Purchase Orders', href: '/purchase-orders' },
      { label: 'Inventory', href: '/inventory' },
      { label: 'Fixed Assets', href: '/fixed-assets' },
    ],
  },
  {
    label: 'Violations',
    icon: '△',
    items: [
      { label: 'All Violations', href: '/violations' },
      { label: 'Report Violation', href: '/report-violation' },
      { label: 'Hearings', href: '/violations' },
    ],
  },
  {
    label: 'Vendors',
    icon: '▽',
    items: [
      { label: 'All Vendors', href: '/vendors' },
      { label: 'Contracts', href: '/vendors' },
      { label: 'Insurance', href: '/insurance' },
    ],
  },
  {
    label: 'Board Center',
    icon: '▷',
    items: [
      { label: 'Meetings', href: '/meetings' },
    ],
  },
  {
    label: 'Documents',
    icon: '□',
    items: [
      { label: 'All Documents', href: '/documents' },
      { label: 'Letters', href: '/letters' },
      { label: 'Templates', href: '/documents/templates' },
    ],
  },
  {
    label: 'Communications',
    icon: '⬡',
    items: [
      { label: 'Center', href: '/communication-center' },
      { label: 'SMS', href: '/sms' },
      { label: 'Bulk Notices', href: '/letters' },
    ],
  },
  {
    label: 'Financials',
    icon: '⬒',
    items: [
      { label: 'Overview', href: '/accounting' },
      { label: 'Assessments', href: '/charges' },
      { label: 'Payables', href: '/bills' },
      { label: 'Bank Accounts', href: '/bank-accounts' },
      { label: 'Transfers', href: '/bank-transfers' },
      { label: 'GL Accounts', href: '/gl-accounts' },
      { label: 'Journal Entries', href: '/journal-entries' },
      { label: 'Budgets', href: '/budget' },
      { label: '1099', href: '/accounting/1099' },
    ],
  },
  {
    label: 'Compliance',
    icon: '⬟',
    items: [
      { label: 'Insurance', href: '/insurance' },
      { label: 'Certificates', href: '/insurance' },
      { label: 'Diagnostics', href: '/diagnostics' },
    ],
  },
  {
    label: 'Reports',
    icon: '◈',
    items: [
      { label: 'All Reports', href: '/reports' },
      { label: 'Scheduled', href: '/scheduled-reports' },
      { label: 'Surveys', href: '/surveys' },
    ],
  },
  {
    label: 'Settings',
    icon: '⚙',
    items: [
      { label: 'Team', href: '/settings' },
      { label: 'Branding', href: '/settings/branding' },
      { label: 'AI Provider', href: '/settings/ai' },
    ],
  },
];

export function CommandNav({ portfolioName }: { portfolioName: string }) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="relative flex h-full">
      {/* Main nav rail */}
      <div className={`flex flex-col h-full bg-[#060709] border-r border-[#111114] transition-all ${collapsed ? 'w-[52px]' : 'w-[224px]'}`}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 h-[52px] border-b border-[#111114] flex-shrink-0">
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#d4d4d8] tracking-tight truncate">
                {portfolioName}
              </div>
            </div>
          )}
          <button
            onClick={() => { setCollapsed(!collapsed); setActiveSection(null); }}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#18181b]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={collapsed ? 'rotate-180' : ''}>
              <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
          {NAV.map((section) => {
            const isActive = activeSection === section.label;
            const isCurrentPath = section.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'));

            return (
              <div key={section.label} className="mb-0.5">
                <button
                  onClick={() => setActiveSection(isActive ? null : section.label)}
                  className={`flex items-center w-full gap-2.5 px-3 h-[34px] text-[13px] transition-colors ${
                    isActive || isCurrentPath
                      ? 'text-[#e4e4e7] bg-[#111114]'
                      : 'text-[#6b6b72] hover:text-[#a1a1aa] hover:bg-[#0d0d10]'
                  }`}
                >
                  <span className="flex-shrink-0 w-5 text-center text-[15px] leading-none">{section.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left font-medium tracking-[-0.01em]">{section.label}</span>
                      <svg
                        width="8" height="8" viewBox="0 0 8 8"
                        className={`flex-shrink-0 text-current opacity-40 transition-transform ${isActive ? 'rotate-90' : ''}`}
                      >
                        <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slide-out submenu panel */}
      {activeSection && !collapsed && (
        <div className="absolute left-full top-0 h-full w-[220px] bg-[#0a0b0e] border-r border-[#111114] shadow-2xl shadow-black/30 z-10 animate-in slide-in-from-left-2">
          <div className="px-4 h-[52px] flex items-center border-b border-[#111114]">
            <h3 className="text-[12px] font-semibold text-[#71717a] uppercase tracking-wider">{activeSection}</h3>
          </div>
          <div className="py-2 overflow-y-auto">
            {NAV.find((s) => s.label === activeSection)?.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setActiveSection(null)}
                className={`flex items-center gap-2.5 px-4 h-[34px] text-[13px] transition-colors ${
                  pathname === item.href
                    ? 'text-[#e4e4e7] bg-[#111114] font-medium'
                    : 'text-[#6b6b72] hover:text-[#d4d4d8] hover:bg-[#0d0d10]'
                }`}
              >
                <span className="flex-1 truncate tracking-[-0.01em]">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-semibold text-[#a1a1aa] bg-[#18181b] px-1.5 py-0.5 rounded">{item.badge}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Overlay to close slide-out */}
      {activeSection && !collapsed && (
        <div className="fixed inset-0 z-[5]" onClick={() => setActiveSection(null)} />
      )}
    </div>
  );
}
