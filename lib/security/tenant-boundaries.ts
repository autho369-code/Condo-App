import type { MeResult } from '@/lib/auth/me';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ATTACHMENT_NAME_RE = /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/;
const ARCH_OBJECT_NAME_RE = /^((?:[0-9]{10,17}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))-([a-zA-Z0-9_-][a-zA-Z0-9._-]*)$/i;

export const ARCHITECTURAL_ATTACHMENT_BASE_PATHS = [
  '/portal/architectural',
  '/architectural-reviews',
  '/board/architectural-reviews',
] as const;

export const ARCHITECTURAL_ATTACHMENT_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'heic',
  'doc',
  'docx',
  'xls',
  'xlsx',
]);

export const MAX_ARCHITECTURAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_ARCHITECTURAL_ATTACHMENT_NAME_LENGTH = 180;

export function isCanonicalUuid(value: string): boolean {
  return UUID_RE.test(value);
}

type UnitScopeRow = {
  id?: unknown;
  buildings?: unknown;
};

type UnitAssignment = {
  unitId: string;
  associationId: string;
  portfolioId: string;
};

function one(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

/**
 * Accept a unit assignment only when the RLS-visible unit proves the submitted
 * association and its portfolio. Non-platform callers must stay in their own
 * portfolio even if malformed nested data is returned.
 */
export function resolveAuthorizedOwnerUnit(input: {
  submittedUnitId: string;
  submittedAssociationId: string;
  callerPortfolioId: string | null | undefined;
  isPlatformOperator: boolean;
  unit: UnitScopeRow | null | undefined;
}): UnitAssignment | null {
  const { submittedUnitId, submittedAssociationId, callerPortfolioId, isPlatformOperator, unit } = input;
  if (!isCanonicalUuid(submittedUnitId) || !isCanonicalUuid(submittedAssociationId) || !unit) return null;
  if (unit.id !== submittedUnitId) return null;

  const building = one(unit.buildings);
  const association = one(building?.associations);
  const associationId = typeof building?.association_id === 'string' ? building.association_id : null;
  const embeddedAssociationId = typeof association?.id === 'string' ? association.id : null;
  const portfolioId = typeof association?.portfolio_id === 'string' ? association.portfolio_id : null;

  if (
    associationId !== submittedAssociationId
    || (embeddedAssociationId !== null && embeddedAssociationId !== associationId)
    || !portfolioId
    || !isCanonicalUuid(portfolioId)
  ) return null;

  if (!isPlatformOperator && (!callerPortfolioId || callerPortfolioId !== portfolioId)) return null;
  return { unitId: submittedUnitId, associationId, portfolioId };
}

export function architecturalAttachmentBasePath(value: string): string | null {
  return (ARCHITECTURAL_ATTACHMENT_BASE_PATHS as readonly string[]).includes(value) ? value : null;
}

export function validateArchitecturalAttachmentFile(
  fileName: string,
  fileSize: number,
): { error?: string; safeName?: string } {
  const name = fileName.trim();
  if (!name || name.length > MAX_ARCHITECTURAL_ATTACHMENT_NAME_LENGTH) {
    return { error: `File names must be between 1 and ${MAX_ARCHITECTURAL_ATTACHMENT_NAME_LENGTH} characters` };
  }
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
    return { error: 'File name contains an invalid path character' };
  }
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) return { error: 'Empty or invalid file' };
  if (fileSize > MAX_ARCHITECTURAL_ATTACHMENT_BYTES) {
    return { error: `"${name}" is over ${Math.round(MAX_ARCHITECTURAL_ATTACHMENT_BYTES / 1048576)} MB` };
  }

  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : null;
  if (!extension || !ARCHITECTURAL_ATTACHMENT_EXTENSIONS.has(extension)) {
    return { error: 'Unsupported file type' };
  }

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!SAFE_ATTACHMENT_NAME_RE.test(safeName) || safeName === '.' || safeName === '..') {
    return { error: 'File name is invalid' };
  }
  return { safeName };
}

/** Accept both the new UUID object names and existing timestamp-based objects. */
export function isArchitecturalAttachmentPath(
  requestId: string,
  path: string,
  expectedSafeName?: string,
): boolean {
  if (!isCanonicalUuid(requestId) || !path) return false;
  const prefix = `architectural/${requestId}/`;
  if (!path.startsWith(prefix)) return false;
  const objectName = path.slice(prefix.length);
  if (!objectName || objectName.includes('/') || objectName.includes('\\') || objectName.includes('..')) return false;
  const match = ARCH_OBJECT_NAME_RE.exec(objectName);
  const safeName = match?.[2];
  if (!safeName || !SAFE_ATTACHMENT_NAME_RE.test(safeName)) return false;
  return expectedSafeName === undefined || safeName === expectedSafeName;
}

export type ArchitecturalAttachmentAccessRole = 'owner' | 'staff' | 'board' | 'operator';

/**
 * Bind an architectural action to the surface that invoked it. This keeps a
 * disabled owner from using an owner-portal action directly while preserving
 * the same identity's independent staff, board, or operator access on those
 * dedicated surfaces.
 */
export function architecturalSurfaceAccessRole(input: {
  basePath: string;
  me: Pick<MeResult,
    | 'owner_id'
    | 'is_staff'
    | 'is_company_admin'
    | 'is_platform_operator'
    | 'is_board'
    | 'board_association_ids'>;
  request: { owner_id: string | null; association_id: string };
  ownerPortalActive: boolean;
  staffCanAccessAssociation: boolean;
}): ArchitecturalAttachmentAccessRole | null {
  const { basePath, me, request, ownerPortalActive, staffCanAccessAssociation } = input;
  if (architecturalAttachmentBasePath(basePath) !== basePath) return null;

  if (basePath === '/portal/architectural') {
    return ownerPortalActive && !!me.owner_id && me.owner_id === request.owner_id ? 'owner' : null;
  }
  if (basePath === '/architectural-reviews') {
    if (me.is_platform_operator) return 'operator';
    return (me.is_staff || me.is_company_admin) && staffCanAccessAssociation ? 'staff' : null;
  }
  if (basePath === '/board/architectural-reviews') {
    if (me.is_platform_operator) return 'operator';
    return me.is_board && (me.board_association_ids ?? []).includes(request.association_id) ? 'board' : null;
  }
  return null;
}

/**
 * This is used only after the request was fetched through the caller's RLS
 * client. It provides a second, explicit role/association check before service
 * role storage or database mutations are allowed.
 */
export function architecturalAttachmentAccessRole(
  me: Pick<MeResult,
    | 'owner_id'
    | 'is_staff'
    | 'is_company_admin'
    | 'is_platform_operator'
    | 'is_board'
    | 'board_association_ids'>,
  request: { owner_id: string | null; association_id: string },
  staffCanAccessAssociation: boolean,
): ArchitecturalAttachmentAccessRole | null {
  if (me.is_platform_operator) return 'operator';
  if ((me.is_staff || me.is_company_admin) && staffCanAccessAssociation) return 'staff';
  if (me.is_board && (me.board_association_ids ?? []).includes(request.association_id)) return 'board';
  if (me.owner_id && me.owner_id === request.owner_id) return 'owner';
  return null;
}
