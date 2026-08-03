import { describe, expect, it } from 'vitest';
import { appModules, type AppModule } from '@/lib/navigation/modules';
import { platformOperatorModules } from '@/lib/navigation/role-modules';

describe('appModules', () => {
  it('includes the core operating modules', () => {
    const labels = appModules.map((module: AppModule) => module.label);
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Associations');
    expect(labels).toContain('Accounting');
    expect(labels).toContain('Reports');
    expect(labels).toContain('Violations');
    expect(labels).toContain('People');
    expect(labels).toContain('Vendors');
  });

  it('keeps buried operational workflows discoverable from grouped modules', () => {
    const byLabel = new Map(appModules.map((module) => [module.label, module]));
    const childHrefs = (label: string) => byLabel.get(label)?.children?.map((child) => child.href) ?? [];

    expect(childHrefs('Reports')).toEqual(expect.arrayContaining([
      '/reports/builder',
      '/scheduled-reports',
      '/reports/monthly-package',
      '/reports/bulk-association',
      '/reports/runs',
    ]));
    expect(childHrefs('Maintenance')).toEqual(expect.arrayContaining([
      '/recurring-work-orders',
      '/inspections',
      '/projects',
      '/purchase-orders',
      '/inventory',
      '/fixed-assets',
    ]));
    expect(childHrefs('Violations')).toEqual(expect.arrayContaining([
      '/violations/field',
      '/compliance',
      '/architectural-reviews',
    ]));
    expect(childHrefs('Communication')).toEqual(expect.arrayContaining(['/inbox', '/letters/mail', '/surveys']));
  });
});

describe('platformOperatorModules', () => {
  it('keeps platform operator navigation focused on oversight', () => {
    const labels = platformOperatorModules.map((module: AppModule) => module.label);
    expect(labels).toContain('Companies');
    expect(labels).toContain('Invitations');
    expect(labels).toContain('Billing');
    expect(labels).toContain('Revenue');
    expect(labels).toContain('Operators');
  });

  it('does not expose manager operating modules in the platform shell', () => {
    const labels = platformOperatorModules.map((module: AppModule) => module.label);
    expect(labels).not.toContain('Maintenance');
    expect(labels).not.toContain('Vendors');
    expect(labels).not.toContain('Accounting');
    expect(labels).not.toContain('Violations');
    expect(labels).not.toContain('People');
  });
});
