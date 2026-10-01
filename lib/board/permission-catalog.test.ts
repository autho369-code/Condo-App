import { describe, expect, it } from 'vitest';
import { boardModules } from '@/lib/navigation/role-modules';
import {
  BOARD_PERMISSIONS,
  BOARD_ROLES,
  PERMISSION_LABELS,
  RECOMMENDED_PERMISSIONS,
  ROLE_LABELS,
  SECTION_PERMISSIONS,
} from './permission-catalog';

describe('board officer permission catalog', () => {
  it('matches the database enum and check constraint', () => {
    expect([...BOARD_ROLES].sort()).toEqual(['director', 'president', 'secretary', 'treasurer', 'vice_president']);
    expect([...BOARD_PERMISSIONS].sort()).toEqual(['comment_cases', 'view_delinquency', 'view_financials', 'vote_approvals']);
  });

  it('labels every role and permission', () => {
    for (const role of BOARD_ROLES) expect(ROLE_LABELS[role]).toBeTruthy();
    for (const permission of BOARD_PERMISSIONS) expect(PERMISSION_LABELS[permission].title).toBeTruthy();
  });

  it('recommends a non-empty set of real roles for every permission', () => {
    for (const permission of BOARD_PERMISSIONS) {
      const roles = RECOMMENDED_PERMISSIONS[permission];
      expect(roles.length).toBeGreaterThan(0);
      for (const role of roles) expect(BOARD_ROLES).toContain(role);
    }
    // Money decisions stay with the president and treasurer.
    expect([...RECOMMENDED_PERMISSIONS.vote_approvals].sort()).toEqual(['president', 'treasurer']);
  });

  it('only gates sections that exist in the board nav', () => {
    const hrefs = new Set(boardModules.map((m) => m.href));
    for (const href of Object.keys(SECTION_PERMISSIONS)) expect(hrefs.has(href)).toBe(true);
  });
});
