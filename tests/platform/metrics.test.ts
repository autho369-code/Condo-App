import { describe, expect, it } from 'vitest';
import { summarizePortfolioHealth, formatSeatUsage } from '@/lib/platform/metrics';

describe('summarizePortfolioHealth', () => {
  it('rolls portfolio health into platform operator totals', () => {
    const summary = summarizePortfolioHealth([
      {
        portfolio_id: 'a',
        subscription_status: 'trialing',
        association_count: 2,
        unit_count: 8,
        seats_used: 2,
        seats_included: 10,
        pending_invitations: 1,
        failed_logins_24h: 0,
      },
      {
        portfolio_id: 'b',
        subscription_status: 'active',
        association_count: '5',
        unit_count: '22',
        seats_used: '7',
        seats_included: '12',
        pending_invitations: '2',
        failed_logins_24h: '3',
      },
      {
        portfolio_id: 'c',
        subscription_status: null,
        association_count: null,
        unit_count: null,
        seats_used: null,
        seats_included: null,
        pending_invitations: null,
        failed_logins_24h: null,
      },
    ]);

    expect(summary).toEqual({
      totalClients: 3,
      totalAssociations: 7,
      totalUnits: 30,
      activeSeats: 9,
      includedSeats: 22,
      trialAccounts: 1,
      paidAccounts: 1,
      pendingInvitations: 3,
      failedLogins24h: 3,
      alertCount: 6,
    });
  });
});

describe('formatSeatUsage', () => {
  it('shows included seats when they exist and a dash when they do not', () => {
    expect(formatSeatUsage({ seats_used: 4, seats_included: 10 })).toBe('4 / 10');
    expect(formatSeatUsage({ seats_used: 4, seats_included: null })).toBe('4 / -');
  });
});
