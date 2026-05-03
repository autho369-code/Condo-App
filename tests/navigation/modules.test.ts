import { describe, expect, it } from 'vitest';
import { appModules } from '@/lib/navigation/modules';
import { platformModules } from '@/lib/navigation/platform-modules';

describe('appModules', () => {
  it('includes the core operating modules', () => {
    const labels = appModules.map((module) => module.label);
    expect(labels).toContain('Command');
    expect(labels).toContain('Associations');
    expect(labels).toContain('Accounting');
    expect(labels).toContain('Reports');
    expect(labels).toContain('Violations');
    expect(labels).toContain('People');
    expect(labels).toContain('Vendors');
  });
});

describe('platformModules', () => {
  it('keeps platform operator navigation focused on oversight', () => {
    const labels = platformModules.map((module) => module.label);
    expect(labels).toEqual([
      'Clients',
      'Properties',
      'Owners',
      'Users',
      'Billing',
      'System Health',
    ]);
  });

  it('does not expose manager operating modules in the global admin shell', () => {
    const labels = platformModules.map((module) => module.label);
    expect(labels).not.toContain('Maintenance');
    expect(labels).not.toContain('Vendors');
    expect(labels).not.toContain('Communication');
    expect(labels).not.toContain('Violations');
    expect(labels).not.toContain('People');
  });
});
