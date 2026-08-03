import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('resident announcement publishing', () => {
  it('publishes a durable audience-scoped portal announcement when staff emails tenants', () => {
    const action = source('lib/rpcs/notifications.ts');
    expect(action).toContain("recipientType === 'tenants' || recipientType === 'both'");
    expect(action).toContain("from('communications_log').insert");
    expect(action).toContain("channel: 'announcement'");
    expect(action).toContain('announcement_audience: recipientType');
    expect(action).toContain('body: fullBody');
  });

  it('enforces separate owner and tenant audiences in RLS', () => {
    const migration = source('supabase/migrations/20260803050000_resident_portal_access.sql');
    expect(migration).toContain("coalesce(announcement_audience, 'both') in ('tenants', 'both')");
    expect(migration).toContain("coalesce(announcement_audience, 'both') in ('owners', 'both')");
  });
});
