import { describe, expect, it } from 'vitest';

import { boardRoleLabel, normalizeBoardMemberForm } from '@/lib/associations/board-members';

describe('board member helpers', () => {
  it('normalizes a board member form into an insert payload', () => {
    const formData = new FormData();
    formData.set('full_name', '  Ada Lovelace  ');
    formData.set('role', 'treasurer');
    formData.set('term_start', '2026-01-01');
    formData.set('term_end', '');
    formData.set('phone', ' 312-555-0100 ');
    formData.set('email', ' ADA@Example.COM ');
    formData.set('signature_on_file', 'on');

    expect(normalizeBoardMemberForm('assoc-1', formData)).toEqual({
      association_id: 'assoc-1',
      full_name: 'Ada Lovelace',
      role: 'treasurer',
      term_start: '2026-01-01',
      term_end: null,
      phone: '312-555-0100',
      email: 'ada@example.com',
      signature_on_file: true,
      active: true,
    });
  });

  it('requires a name and falls back to director for unknown roles', () => {
    const formData = new FormData();
    formData.set('full_name', 'Grace Hopper');
    formData.set('role', 'chairperson');

    expect(normalizeBoardMemberForm('assoc-1', formData).role).toBe('director');

    formData.set('full_name', ' ');
    expect(() => normalizeBoardMemberForm('assoc-1', formData)).toThrow('Board member name is required.');
  });

  it('renders board role labels for the UI', () => {
    expect(boardRoleLabel('vice_president')).toBe('Vice President');
    expect(boardRoleLabel(null)).toBe('-');
  });
});
