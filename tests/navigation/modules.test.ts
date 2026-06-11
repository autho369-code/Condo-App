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
