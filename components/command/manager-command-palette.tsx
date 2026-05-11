'use client';
import { CommandPalette, useCommandNavigate, type CommandItem } from './command-palette';

/**
 * Manager-side command palette. Lists every page in the workspace + common
 * actions. The user opens it with Cmd/Ctrl+K from anywhere in the staff app.
 */
export function ManagerCommandPalette() {
  const go = useCommandNavigate();

  const items: CommandItem[] = [
    // ---------- Workspace ----------
    { id: 'go.dashboard', label: 'Command centre', group: 'Workspace', hint: 'Cmd+1', perform: go('/dashboard'), keywords: ['home', 'overview'] },
    { id: 'go.inbox', label: 'Inbox', group: 'Workspace', perform: go('/inbox') },
    { id: 'go.calendar', label: 'Calendar', group: 'Workspace', perform: go('/calendar') },
    { id: 'go.metrics', label: 'Metrics', group: 'Workspace', perform: go('/metrics') },

    // ---------- Associations ----------
    { id: 'go.associations', label: 'All associations', group: 'Associations', perform: go('/associations') },
    { id: 'new.association',  label: '+ New association', group: 'Associations', perform: go('/associations/new'), keywords: ['create', 'add'] },
    { id: 'go.units',         label: 'Units',             group: 'Associations', perform: go('/units') },
    { id: 'go.owners',        label: 'Owners',            group: 'Associations', perform: go('/owners') },

    // ---------- Accounting ----------
    { id: 'go.charges',     label: 'Receivables (charges)', group: 'Accounting', perform: go('/charges') },
    { id: 'go.bills',       label: 'Payables (bills)',      group: 'Accounting', perform: go('/bills') },
    { id: 'new.bill',       label: '+ New bill',            group: 'Accounting', perform: go('/bills/new') },
    { id: 'go.checkrun',    label: 'Check run wizard',      group: 'Accounting', perform: go('/bills/check-run') },
    { id: 'go.bank',        label: 'Bank accounts',         group: 'Accounting', perform: go('/bank-accounts') },
    { id: 'go.bank.adj',    label: '+ Bank adjustment',     group: 'Accounting', perform: go('/bank-accounts/adjustments/new') },
    { id: 'go.je',          label: 'Journal entries',       group: 'Accounting', perform: go('/journal-entries') },
    { id: 'go.transfers',   label: 'Bank transfers',        group: 'Accounting', perform: go('/bank-transfers') },
    { id: 'go.gl',          label: 'GL accounts',           group: 'Accounting', perform: go('/gl-accounts') },

    // ---------- Reports ----------
    { id: 'go.reports',      label: 'Standard reports', group: 'Reports', perform: go('/reports') },
    { id: 'go.reports.runs', label: 'Recent report runs', group: 'Reports', perform: go('/reports/runs') },
    { id: 'go.reports.aging',label: 'A/R aging report',   group: 'Reports', perform: go('/reports/ar-aging') },
    { id: 'go.scheduled',    label: 'Scheduled reports',  group: 'Reports', perform: go('/scheduled-reports') },

    // ---------- Maintenance ----------
    { id: 'go.workorders', label: 'Work orders',     group: 'Maintenance', perform: go('/work-orders') },
    { id: 'go.recurring',  label: 'Recurring work orders', group: 'Maintenance', perform: go('/recurring-work-orders') },
    { id: 'go.vendors',    label: 'Vendors',         group: 'Maintenance', perform: go('/vendors') },
    { id: 'go.inspect',    label: 'Inspections',     group: 'Maintenance', perform: go('/inspections') },

    // ---------- Compliance ----------
    { id: 'go.violations',     label: 'Violations',     group: 'Compliance', perform: go('/violations') },
    { id: 'new.violation',     label: '+ New violation', group: 'Compliance', perform: go('/violations/new') },
    { id: 'go.compliance',     label: 'Compliance overview', group: 'Compliance', perform: go('/compliance') },
    { id: 'go.letters',        label: 'Letter templates', group: 'Compliance', perform: go('/letters') },

    // ---------- Communication ----------
    { id: 'go.comm',     label: 'Communication centre', group: 'Communication', perform: go('/communication-center') },
    { id: 'go.send',     label: 'Send email',           group: 'Communication', perform: go('/send-email') },

    // ---------- Settings ----------
    { id: 'go.settings.brand',  label: 'Brand identity',  group: 'Settings', hint: 'Cmd+B', perform: go('/settings/branding'), keywords: ['logo', 'favicon', 'colors'] },
    { id: 'go.settings.policy', label: 'Policy & fees',   group: 'Settings', perform: go('/settings') },

    // ---------- Apex shortcuts (operator-only, but harmless to leave) ----------
    { id: 'go.platform',       label: 'Platform console', group: 'Platform', perform: go('/platform/portfolios') },
    { id: 'go.leads',          label: 'Access requests',  group: 'Platform', perform: go('/platform/leads') },
  ];

  return <CommandPalette items={items} />;
}
