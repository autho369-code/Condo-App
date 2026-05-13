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
    { id: 'go.dashboard', label: 'Dashboard', group: 'Workspace', hint: 'Cmd+1', perform: go('/dashboard'), keywords: ['home', 'overview', 'search'] },

    // ---------- Associations ----------
    { id: 'go.associations', label: 'All associations', group: 'Associations', perform: go('/associations') },
    { id: 'new.association',  label: '+ New association', group: 'Associations', perform: go('/associations/new'), keywords: ['create', 'add'] },
    { id: 'go.units',         label: 'Units',             group: 'Associations', perform: go('/units') },
    { id: 'new.unit',         label: '+ New unit',        group: 'Associations', perform: go('/units/new'), keywords: ['create', 'add'] },
    { id: 'go.owners',        label: 'Owners',            group: 'Associations', perform: go('/owners') },
    { id: 'new.owner',        label: '+ New owner',       group: 'Associations', perform: go('/owners/new'), keywords: ['create', 'add'] },
    { id: 'go.owner.invites', label: 'Owner portal invites', group: 'Associations', perform: go('/owners/activations'), keywords: ['portal', 'invite', 'password', 'reset'] },

    // ---------- Accounting ----------
    { id: 'go.charges',     label: 'Receivables (charges)', group: 'Accounting', perform: go('/charges') },
    { id: 'new.payment',    label: '+ Owner payment',       group: 'Accounting', perform: go('/payments/new') },
    { id: 'apply.credit',   label: 'Apply credit',          group: 'Accounting', perform: go('/credits/apply') },
    { id: 'go.bills',       label: 'Payables (bills)',      group: 'Accounting', perform: go('/bills') },
    { id: 'new.bill',       label: '+ New bill',            group: 'Accounting', perform: go('/bills/new') },
    { id: 'go.checkrun',    label: 'Check run wizard',      group: 'Accounting', perform: go('/bills/check-run') },
    { id: 'go.vendors',     label: 'Vendors',               group: 'Accounting', perform: go('/vendors') },
    { id: 'new.vendor',     label: '+ New vendor',          group: 'Accounting', perform: go('/vendors/new') },
    { id: 'go.bank',        label: 'Bank accounts',         group: 'Accounting', perform: go('/bank-accounts') },
    { id: 'go.je',          label: 'Journal entries',       group: 'Accounting', perform: go('/journal-entries') },
    { id: 'go.transfers',   label: 'Bank transfers',        group: 'Accounting', perform: go('/bank-transfers') },
    { id: 'go.gl',          label: 'GL accounts',           group: 'Accounting', perform: go('/gl-accounts') },

    // ---------- Reports ----------
    { id: 'go.reports',      label: 'Standard reports', group: 'Reports', perform: go('/reports') },
    { id: 'go.reports.runs', label: 'Recent report runs', group: 'Reports', perform: go('/reports/runs') },
    { id: 'go.reports.aging',label: 'A/R aging report',   group: 'Reports', perform: go('/reports/ar-aging') },
    { id: 'go.scheduled',    label: 'Scheduled reports',  group: 'Reports', perform: go('/scheduled-reports') },

    // ---------- Maintenance ----------
    { id: 'go.workorders', label: 'Work orders',     group: 'Work Orders', perform: go('/work-orders') },
    { id: 'new.workorder', label: '+ New work order', group: 'Work Orders', perform: go('/work-orders/new') },

    // ---------- Compliance ----------
    { id: 'go.violations',     label: 'Violations',     group: 'Compliance', perform: go('/violations') },
    { id: 'new.violation',     label: '+ New violation', group: 'Compliance', perform: go('/violations/new') },

    // ---------- Communication ----------
    { id: 'go.comm',     label: 'Communication centre', group: 'Communication', perform: go('/communication-center') },
    { id: 'go.send',     label: 'Send email',           group: 'Communication', perform: go('/send-email') },

    // ---------- Settings ----------
    { id: 'go.settings.brand',  label: 'Brand identity',  group: 'Settings', hint: 'Cmd+B', perform: go('/settings/branding'), keywords: ['logo', 'favicon', 'colors'] },
    { id: 'go.settings.policy', label: 'Policy & fees',   group: 'Settings', perform: go('/settings') },

  ];

  return <CommandPalette items={items} />;
}
