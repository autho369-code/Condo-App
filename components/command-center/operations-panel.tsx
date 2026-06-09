'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

type PanelSection = { title: string; links: { label: string; href: string }[] };

function getPanelForRoute(pathname: string): PanelSection[] {
  if (pathname === '/dashboard' || pathname === '/') {
    return [
      { title: 'Tasks', links: [
        { label: 'Review violations', href: '/violations' },
        { label: 'Approve bills', href: '/bills' },
        { label: 'Assign work orders', href: '/work-orders' },
        { label: 'Send notices', href: '/letters/new' },
      ]},
      { title: 'Deadlines', links: [
        { label: 'Upcoming hearings', href: '/violations' },
        { label: 'Expiring certificates', href: '/insurance' },
        { label: 'Board meetings', href: '/meetings' },
      ]},
      { title: 'Quick Actions', links: [
        { label: 'New violation', href: '/violations/new' },
        { label: 'New work order', href: '/work-orders/new' },
        { label: 'New bill', href: '/bills/new' },
        { label: 'New notice', href: '/letters/new' },
      ]},
    ];
  }

  if (pathname.startsWith('/work-orders')) {
    return [
      { title: 'Tasks', links: [
        { label: 'New work order', href: '/work-orders/new' },
        { label: 'Recurring work orders', href: '/recurring-work-orders' },
        { label: 'Assign vendor', href: '/vendors' },
      ]},
      { title: 'Reports', links: [
        { label: 'Work order report', href: '/reports' },
        { label: 'Labor summary', href: '/reports' },
        { label: 'Billable detail', href: '/reports' },
      ]},
      { title: 'Related', links: [
        { label: 'Vendors', href: '/vendors' },
        { label: 'Inspections', href: '/inspections' },
        { label: 'Unit turns', href: '/unit-turns' },
      ]},
    ];
  }

  if (pathname.startsWith('/violations')) {
    return [
      { title: 'Tasks', links: [
        { label: 'New violation', href: '/violations/new' },
        { label: 'Report violation', href: '/report-violation' },
        { label: 'Schedule hearing', href: '/violations/new' },
      ]},
      { title: 'Reports', links: [
        { label: 'Violation report', href: '/reports' },
        { label: 'Hearing schedule', href: '/violations' },
      ]},
      { title: 'Templates', links: [
        { label: 'Violation notice', href: '/documents' },
        { label: 'Hearing notice', href: '/documents' },
        { label: 'Cure notice', href: '/documents' },
      ]},
    ];
  }

  if (pathname.startsWith('/owners')) {
    return [
      { title: 'Tasks', links: [
        { label: 'New owner', href: '/owners/new' },
        { label: 'Send notice', href: '/letters/new' },
        { label: 'Owner ledger', href: '/charges' },
      ]},
      { title: 'Reports', links: [
        { label: 'Owner directory', href: '/reports' },
        { label: 'Delinquency report', href: '/reports' },
        { label: 'Owner ledger', href: '/reports' },
      ]},
    ];
  }

  if (pathname.startsWith('/vendors')) {
    return [
      { title: 'Tasks', links: [
        { label: 'New vendor', href: '/vendors/new' },
        { label: 'Request documents', href: '/vendors' },
        { label: 'Request W-9', href: '/vendors' },
      ]},
      { title: 'Reports', links: [
        { label: 'Vendor directory', href: '/reports' },
        { label: 'Vendor ledger', href: '/reports' },
        { label: 'Insurance status', href: '/insurance' },
      ]},
    ];
  }

  if (pathname.startsWith('/bills') || pathname.startsWith('/charges') || pathname.startsWith('/bank-accounts') || pathname.startsWith('/journal-entries') || pathname.startsWith('/gl-accounts') || pathname.startsWith('/bank-transfers') || pathname.startsWith('/budget') || pathname.startsWith('/accounting')) {
    return [
      { title: 'Tasks', links: [
        { label: 'Enter bill', href: '/bills/new' },
        { label: 'New charge', href: '/charges' },
        { label: 'Bank deposit', href: '/bank-accounts/deposits/new' },
      ]},
      { title: 'Reports', links: [
        { label: 'Balance sheet', href: '/reports' },
        { label: 'Income statement', href: '/reports' },
        { label: 'Cash flow', href: '/reports' },
        { label: 'Trial balance', href: '/reports' },
      ]},
      { title: 'Quick Links', links: [
        { label: 'Bank accounts', href: '/bank-accounts' },
        { label: 'GL accounts', href: '/gl-accounts' },
        { label: 'Journal entries', href: '/journal-entries' },
        { label: '1099 reporting', href: '/accounting/1099' },
      ]},
    ];
  }

  if (pathname.startsWith('/associations') || pathname.startsWith('/units') || pathname.startsWith('/buildings')) {
    return [
      { title: 'Tasks', links: [
        { label: 'New association', href: '/associations/new' },
        { label: 'New unit', href: '/units/new' },
        { label: 'Bulk update', href: '/associations' },
      ]},
      { title: 'Reports', links: [
        { label: 'Association directory', href: '/reports' },
        { label: 'Unit directory', href: '/reports' },
        { label: 'Dues roll', href: '/reports' },
      ]},
    ];
  }

  if (pathname.startsWith('/calendar')) {
    return [
      { title: 'Quick Actions', links: [
        { label: 'Create event', href: '/calendar/new' },
        { label: 'Board meeting', href: '/calendar/new' },
        { label: 'Maintenance event', href: '/calendar/new' },
      ]},
      { title: 'Views', links: [
        { label: 'Month view', href: '/calendar' },
        { label: 'Upcoming events', href: '/calendar' },
      ]},
    ];
  }

  if (pathname.startsWith('/reports') || pathname.startsWith('/metrics') || pathname.startsWith('/surveys')) {
    return [
      { title: 'Tasks', links: [
        { label: 'New report run', href: '/reports' },
        { label: 'Schedule report', href: '/scheduled-reports' },
        { label: 'Bulk reports', href: '/reports' },
      ]},
      { title: 'Common Reports', links: [
        { label: 'Balance sheet', href: '/reports' },
        { label: 'Income statement', href: '/reports' },
        { label: 'Delinquency', href: '/reports' },
        { label: 'Dues roll', href: '/reports' },
      ]},
    ];
  }

  if (pathname.startsWith('/documents') || pathname.startsWith('/letters')) {
    return [
      { title: 'Tasks', links: [
        { label: 'New document', href: '/documents' },
        { label: 'New letter', href: '/letters/new' },
        { label: 'New template', href: '/documents/templates/new' },
      ]},
      { title: 'Templates', links: [
        { label: 'Violation notice', href: '/documents' },
        { label: 'Welcome letter', href: '/documents' },
        { label: 'Assessment letter', href: '/documents' },
      ]},
    ];
  }

  if (pathname.startsWith('/settings')) {
    return [
      { title: 'Settings', links: [
        { label: 'Team management', href: '/settings' },
        { label: 'Branding', href: '/settings/branding' },
        { label: 'AI provider', href: '/settings/ai' },
      ]},
    ];
  }

  // Default for any other page
  return [
    { title: 'Tasks', links: [
      { label: 'New violation', href: '/violations/new' },
      { label: 'New work order', href: '/work-orders/new' },
      { label: 'Enter bill', href: '/bills/new' },
    ]},
    { title: 'Reports', links: [
      { label: 'View reports', href: '/reports' },
    ]},
  ];
}

export function OperationsPanel() {
  const pathname = usePathname();
  const sections = getPanelForRoute(pathname);

  return (
    <div className="w-[288px] flex-shrink-0 h-full bg-[#fafbfc] border-l border-gray-200 overflow-y-auto">
      {sections.map((section, i) => (
        <div key={i} className={`px-4 ${i === 0 ? 'pt-5' : 'pt-4'} pb-4 ${i < sections.length - 1 ? 'border-b border-gray-100' : ''}`}>
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{section.title}</h3>
          <div className="space-y-0.5">
            {section.links.map((link, j) => (
              <Link
                key={j}
                href={link.href}
                className="block px-3 py-1.5 rounded text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
