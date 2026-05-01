export type CommandCounts = {
  openViolations: number;
  overdueViolations: number;
  pendingBills: number;
  unreconciledBankAccounts: number;
  scheduledReportsDue: number;
  openWorkOrders: number;
};

export function buildCommandMetrics(counts: CommandCounts) {
  return [
    { label: 'Open violations', value: counts.openViolations, href: '/violations?status=open' },
    { label: 'Overdue violations', value: counts.overdueViolations, href: '/violations?status=overdue' },
    { label: 'Pending bills', value: counts.pendingBills, href: '/bills?status=pending_approval' },
    { label: 'Unreconciled accounts', value: counts.unreconciledBankAccounts, href: '/bank-accounts?filter=unreconciled' },
    { label: 'Reports due', value: counts.scheduledReportsDue, href: '/scheduled-reports' },
    { label: 'Open work orders', value: counts.openWorkOrders, href: '/work-orders?tab=open' },
  ];
}
