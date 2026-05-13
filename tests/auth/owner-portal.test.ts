import { describe, expect, it } from 'vitest';

import {
  assertOwnerPortalActionAllowed,
  buildOwnerPortalRedirectTo,
  getOwnerPortalStatus,
  normalizeOwnerPortalEmail,
} from '@/lib/auth/owner-portal';

const staff = {
  roles: ['staff'],
  portfolio: { id: 'portfolio-1' },
};

describe('owner portal auth actions', () => {
  it('builds a Supabase email-link redirect into the password setup page', () => {
    expect(buildOwnerPortalRedirectTo('https://portier369.com', '/reset-password')).toBe(
      'https://portier369.com/api/auth/callback?next=%2Freset-password',
    );
  });

  it('normalizes owner emails before sending auth links', () => {
    expect(normalizeOwnerPortalEmail('  OWNER@Example.COM  ')).toBe('owner@example.com');
    expect(normalizeOwnerPortalEmail(null)).toBeNull();
  });

  it('allows staff to act only on owners in their portfolio with an email', () => {
    expect(() =>
      assertOwnerPortalActionAllowed(
        { id: 'owner-1', email: 'owner@example.com', portfolio_id: 'portfolio-1' },
        staff,
      ),
    ).not.toThrow();

    expect(() =>
      assertOwnerPortalActionAllowed(
        { id: 'owner-2', email: 'other@example.com', portfolio_id: 'portfolio-2' },
        staff,
      ),
    ).toThrow('Owner belongs to another portfolio.');

    expect(() =>
      assertOwnerPortalActionAllowed({ id: 'owner-3', email: null, portfolio_id: 'portfolio-1' }, staff),
    ).toThrow('Owner needs an email address before portal access can be sent.');
  });

  it('separates active, invited, and missing-email portal states', () => {
    expect(getOwnerPortalStatus({ email: 'owner@example.com', portal_activated: true, auth_user_id: 'user-1' })).toBe(
      'active',
    );
    expect(getOwnerPortalStatus({ email: 'owner@example.com', portal_activated: false, auth_user_id: 'user-1' })).toBe(
      'invited',
    );
    expect(getOwnerPortalStatus({ email: 'owner@example.com', portal_activated: false, auth_user_id: null })).toBe(
      'needs_invite',
    );
    expect(getOwnerPortalStatus({ email: null, portal_activated: false, auth_user_id: null })).toBe('missing_email');
  });
});
