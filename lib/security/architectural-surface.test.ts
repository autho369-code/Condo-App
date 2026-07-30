import { describe, expect, it } from 'vitest';
import { architecturalSurfaceAccessRole } from './tenant-boundaries';

const baseMe = {
  owner_id: 'owner-1',
  is_staff: false,
  is_company_admin: false,
  is_platform_operator: false,
  is_board: false,
  board_association_ids: [] as string[],
};
const request = { owner_id: 'owner-1', association_id: 'association-1' };

describe('architectural action surface access', () => {
  it('fails closed for a disabled owner on the owner portal surface', () => {
    expect(architecturalSurfaceAccessRole({
      basePath: '/portal/architectural',
      me: baseMe,
      request,
      ownerPortalActive: false,
      staffCanAccessAssociation: false,
    })).toBeNull();
  });

  it('allows the same active owner on the owner portal surface', () => {
    expect(architecturalSurfaceAccessRole({
      basePath: '/portal/architectural',
      me: baseMe,
      request,
      ownerPortalActive: true,
      staffCanAccessAssociation: false,
    })).toBe('owner');
  });

  it('preserves independent staff and board access on their own surfaces', () => {
    expect(architecturalSurfaceAccessRole({
      basePath: '/architectural-reviews',
      me: { ...baseMe, owner_id: null, is_staff: true },
      request,
      ownerPortalActive: false,
      staffCanAccessAssociation: true,
    })).toBe('staff');
    expect(architecturalSurfaceAccessRole({
      basePath: '/board/architectural-reviews',
      me: { ...baseMe, owner_id: null, is_board: true, board_association_ids: ['association-1'] },
      request,
      ownerPortalActive: false,
      staffCanAccessAssociation: false,
    })).toBe('board');
  });

  it('rejects unknown or mismatched action surfaces', () => {
    expect(architecturalSurfaceAccessRole({
      basePath: '//evil.example',
      me: baseMe,
      request,
      ownerPortalActive: true,
      staffCanAccessAssociation: false,
    })).toBeNull();
  });
});
