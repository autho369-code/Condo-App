export type PortfolioHealthRow = {
  portfolio_id?: string | null;
  company_name?: string | null;
  tier?: string | null;
  subscription_status?: string | null;
  association_count?: number | string | null;
  unit_count?: number | string | null;
  seats_used?: number | string | null;
  seats_included?: number | string | null;
  pending_invitations?: number | string | null;
  failed_logins_24h?: number | string | null;
  suspended_at?: string | null;
};

export type PlatformSummary = {
  totalClients: number;
  totalAssociations: number;
  totalUnits: number;
  activeSeats: number;
  includedSeats: number;
  trialAccounts: number;
  paidAccounts: number;
  pendingInvitations: number;
  failedLogins24h: number;
  alertCount: number;
};

export function toCount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizePortfolioHealth(rows: PortfolioHealthRow[]): PlatformSummary {
  const summary = rows.reduce(
    (acc, row) => {
      acc.totalAssociations += toCount(row.association_count);
      acc.totalUnits += toCount(row.unit_count);
      acc.activeSeats += toCount(row.seats_used);
      acc.includedSeats += toCount(row.seats_included);
      acc.pendingInvitations += toCount(row.pending_invitations);
      acc.failedLogins24h += toCount(row.failed_logins_24h);
      if (row.subscription_status === 'trialing') acc.trialAccounts += 1;
      if (row.subscription_status === 'active') acc.paidAccounts += 1;
      return acc;
    },
    {
      totalClients: rows.length,
      totalAssociations: 0,
      totalUnits: 0,
      activeSeats: 0,
      includedSeats: 0,
      trialAccounts: 0,
      paidAccounts: 0,
      pendingInvitations: 0,
      failedLogins24h: 0,
      alertCount: 0,
    },
  );

  summary.alertCount = summary.pendingInvitations + summary.failedLogins24h;
  return summary;
}

export function formatSeatUsage(row: Pick<PortfolioHealthRow, 'seats_used' | 'seats_included'>) {
  const used = toCount(row.seats_used);
  const included = row.seats_included === null || row.seats_included === undefined ? '-' : toCount(row.seats_included);
  return `${used} / ${included}`;
}

export function platformStatus(row: Pick<PortfolioHealthRow, 'suspended_at' | 'subscription_status'>) {
  if (row.suspended_at) return 'suspended';
  return row.subscription_status ?? 'not configured';
}

export function statusClass(status: string) {
  if (status === 'active') return 'bg-green-50 text-green-700 ring-green-200';
  if (status === 'trialing') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (status === 'suspended' || status === 'past_due' || status === 'unpaid') return 'bg-red-50 text-red-700 ring-red-200';
  return 'bg-gray-50 text-gray-700 ring-gray-200';
}
