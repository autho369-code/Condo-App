import { describe, expect, it } from 'vitest';
import { appModules } from '@/lib/navigation/modules';

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
