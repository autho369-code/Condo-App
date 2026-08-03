import { describe, expect, it } from 'vitest';
import { getActionCenter } from '@/lib/navigation/action-center';

const manager = { isStaff: true, isFinanceStaff: false, isAdmin: false };
const companyAdmin = { isStaff: false, isFinanceStaff: false, isAdmin: true };
const financeAdmin = { isStaff: true, isFinanceStaff: true, isAdmin: true };

function hrefs(pathname: string, permissions = manager) {
  return getActionCenter(pathname, '', permissions)?.sections.flatMap((section) => section.links.map((link) => link.href)) ?? [];
}

describe('Action Center', () => {
  it('covers the accounting hub and exposes direct reporting workflows', () => {
    const links = hrefs('/accounting', financeAdmin);

    expect(links).toContain('/diagnostics');
    expect(links).toContain('/delinquencies');
    expect(links).toContain('/accounting-periods');
    expect(links).toContain('/reports/balance_sheet');
    expect(links).toContain('/reports/monthly-package');
  });

  it('covers AppFolio-equivalent maintenance surfaces with real Portier routes', () => {
    const links = hrefs('/purchase-orders');

    expect(links).toContain('/work-orders/new');
    expect(links).toContain('/recurring-work-orders/new');
    expect(links).toContain('/inspections/new');
    expect(links).toContain('/projects/new');
    expect(links).toContain('/purchase-orders/new');
    expect(links).toContain('/inventory/new');
    expect(links).toContain('/fixed-assets/new');
  });

  it('keeps finance and administrator actions out of a regular manager panel', () => {
    const managerLinks = hrefs('/accounting', manager);

    expect(managerLinks).not.toContain('/bills/new');
    expect(managerLinks).not.toContain('/bills/check-run');
    expect(managerLinks).not.toContain('/accounting-periods');
    expect(managerLinks).not.toContain('/gl-accounts/permissions');
  });

  it('does not treat company administration as finance access', () => {
    const adminLinks = hrefs('/accounting', companyAdmin);

    expect(adminLinks).not.toContain('/bills/new');
    expect(adminLinks).not.toContain('/bills/check-run');
    expect(adminLinks).not.toContain('/charges/new');
    expect(adminLinks).not.toContain('/journal-entries/new');
    expect(adminLinks).toContain('/accounting-periods');
    expect(adminLinks).toContain('/gl-accounts/permissions');
  });

  it('surfaces field compliance, communications, and report scheduling', () => {
    expect(hrefs('/violations')).toContain('/violations/field');
    expect(hrefs('/inbox')).toContain('/sms/templates');
    expect(hrefs('/reports')).toContain('/scheduled-reports/new');
  });

  it('links homeowner delinquency reporting to the seeded report definition', () => {
    expect(hrefs('/owners')).toContain('/reports/delinquency');
    expect(hrefs('/owners/00000000-0000-4000-8000-000000000001')).toContain('/reports/delinquency');
    expect(hrefs('/owners')).not.toContain('/reports/delinquency_summary');
  });

  it('keeps a consistent Action Center on previously orphaned route families', () => {
    const representativeRoutes = [
      '/accounting',
      '/command-center',
      '/scheduled-reports',
      '/reports/runs',
      '/compliance',
      '/forms',
      '/purchase-orders',
      '/fixed-assets',
      '/units',
      '/parking',
      '/settings',
    ];

    for (const route of representativeRoutes) {
      expect(getActionCenter(route, '', financeAdmin), route).not.toBeNull();
    }
  });
});
