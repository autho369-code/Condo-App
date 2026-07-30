import { describe, expect, it } from 'vitest';

import {
  MAX_ARCHITECTURAL_ATTACHMENT_BYTES,
  architecturalAttachmentAccessRole,
  architecturalAttachmentBasePath,
  isArchitecturalAttachmentPath,
  resolveAuthorizedOwnerUnit,
  validateArchitecturalAttachmentFile,
} from '@/lib/security/tenant-boundaries';

const UNIT_ID = '11111111-1111-4111-8111-111111111111';
const ASSOCIATION_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ASSOCIATION_ID = '33333333-3333-4333-8333-333333333333';
const PORTFOLIO_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_PORTFOLIO_ID = '55555555-5555-4555-8555-555555555555';
const OWNER_ID = '66666666-6666-4666-8666-666666666666';

function me(overrides: Record<string, unknown> = {}) {
  return {
    owner_id: null,
    is_staff: false,
    is_company_admin: false,
    is_platform_operator: false,
    is_board: false,
    board_association_ids: [] as string[],
    ...overrides,
  } as any;
}

describe('owner assignment tenant boundary', () => {
  const unit = {
    id: UNIT_ID,
    buildings: {
      association_id: ASSOCIATION_ID,
      associations: { id: ASSOCIATION_ID, portfolio_id: PORTFOLIO_ID },
    },
  };

  it('derives a matching unit, association, and portfolio', () => {
    expect(resolveAuthorizedOwnerUnit({
      submittedUnitId: UNIT_ID,
      submittedAssociationId: ASSOCIATION_ID,
      callerPortfolioId: PORTFOLIO_ID,
      isPlatformOperator: false,
      unit,
    })).toEqual({ unitId: UNIT_ID, associationId: ASSOCIATION_ID, portfolioId: PORTFOLIO_ID });
  });

  it('rejects a forged association/unit pair', () => {
    expect(resolveAuthorizedOwnerUnit({
      submittedUnitId: UNIT_ID,
      submittedAssociationId: OTHER_ASSOCIATION_ID,
      callerPortfolioId: PORTFOLIO_ID,
      isPlatformOperator: false,
      unit,
    })).toBeNull();
  });

  it('rejects a staff caller outside the resolved portfolio', () => {
    expect(resolveAuthorizedOwnerUnit({
      submittedUnitId: UNIT_ID,
      submittedAssociationId: ASSOCIATION_ID,
      callerPortfolioId: OTHER_PORTFOLIO_ID,
      isPlatformOperator: false,
      unit,
    })).toBeNull();
  });

  it('allows a platform operator only when the unit still proves the association', () => {
    expect(resolveAuthorizedOwnerUnit({
      submittedUnitId: UNIT_ID,
      submittedAssociationId: ASSOCIATION_ID,
      callerPortfolioId: null,
      isPlatformOperator: true,
      unit,
    })?.portfolioId).toBe(PORTFOLIO_ID);
  });
});

describe('architectural attachment tenant boundary', () => {
  const request = { owner_id: OWNER_ID, association_id: ASSOCIATION_ID };

  it('does not treat a global staff flag as association authorization', () => {
    expect(architecturalAttachmentAccessRole(me({ is_staff: true }), request, false)).toBeNull();
    expect(architecturalAttachmentAccessRole(me({ is_staff: true }), request, true)).toBe('staff');
  });

  it('falls back to owner-only authority for a dual-role user outside staff scope', () => {
    expect(architecturalAttachmentAccessRole(
      me({ is_staff: true, owner_id: OWNER_ID }),
      request,
      false,
    )).toBe('owner');
  });

  it('requires a board seat in the request association', () => {
    expect(architecturalAttachmentAccessRole(
      me({ is_board: true, board_association_ids: [OTHER_ASSOCIATION_ID] }),
      request,
      false,
    )).toBeNull();
    expect(architecturalAttachmentAccessRole(
      me({ is_board: true, board_association_ids: [ASSOCIATION_ID] }),
      request,
      false,
    )).toBe('board');
  });

  it('limits owners to their own request', () => {
    expect(architecturalAttachmentAccessRole(me({ owner_id: OWNER_ID }), request, false)).toBe('owner');
    expect(architecturalAttachmentAccessRole(me({ owner_id: '77777777-7777-4777-8777-777777777777' }), request, false)).toBeNull();
  });
});

describe('architectural attachment input validation', () => {
  it('allowlists return paths', () => {
    expect(architecturalAttachmentBasePath('/portal/architectural')).toBe('/portal/architectural');
    expect(architecturalAttachmentBasePath('//attacker.example')).toBeNull();
    expect(architecturalAttachmentBasePath('/portal/architectural/../admin')).toBeNull();
  });

  it('allowlists file extensions, sizes, and simple file names', () => {
    expect(validateArchitecturalAttachmentFile('Floor Plan 2.pdf', 1024)).toEqual({ safeName: 'Floor_Plan_2.pdf' });
    expect(validateArchitecturalAttachmentFile('../plan.pdf', 1024).error).toBeTruthy();
    expect(validateArchitecturalAttachmentFile('payload.html', 1024).error).toBe('Unsupported file type');
    expect(validateArchitecturalAttachmentFile('plan.pdf', MAX_ARCHITECTURAL_ATTACHMENT_BYTES + 1).error).toContain('over 25 MB');
  });

  it('accepts only one server-shaped object in the exact request directory', () => {
    const uuidPath = `architectural/${ASSOCIATION_ID}/88888888-8888-4888-8888-888888888888-plan.pdf`;
    const legacyPath = `architectural/${ASSOCIATION_ID}/1722000000000-plan.pdf`;
    expect(isArchitecturalAttachmentPath(ASSOCIATION_ID, uuidPath, 'plan.pdf')).toBe(true);
    expect(isArchitecturalAttachmentPath(ASSOCIATION_ID, legacyPath, 'plan.pdf')).toBe(true);
    expect(isArchitecturalAttachmentPath(OTHER_ASSOCIATION_ID, uuidPath, 'plan.pdf')).toBe(false);
    expect(isArchitecturalAttachmentPath(ASSOCIATION_ID, `${uuidPath}/nested`, 'plan.pdf')).toBe(false);
    expect(isArchitecturalAttachmentPath(ASSOCIATION_ID, uuidPath, 'other.pdf')).toBe(false);
  });
});
