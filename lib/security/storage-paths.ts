const UNSAFE_PATH_CHARACTER = /[\\%?#\u0000-\u001f\u007f]/;

function storageSegments(value: unknown): string[] | null {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null;
  if (value.startsWith('/') || UNSAFE_PATH_CHARACTER.test(value)) return null;

  const segments = value.split('/');
  if (segments.length < 3) return null;
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return segments;
}

/**
 * Require a private-storage reference to remain inside the object directory
 * belonging to the already-authorized database entity.
 */
export function isScopedStoragePath(
  value: unknown,
  namespace: string,
  entityId: string | null | undefined,
): value is string {
  if (!entityId || namespace.includes('/')) return false;
  const segments = storageSegments(value);
  return !!segments && segments[0] === namespace && segments[1] === entityId;
}

/** Validate the storage conventions used by rows in the documents table. */
export function isEntityDocumentStoragePath(
  value: unknown,
  entityType: string | null | undefined,
  entityId: string | null | undefined,
): value is string {
  const namespaces: Record<string, readonly string[]> = {
    association: ['associations'],
    architectural: ['architectural'],
    meeting: ['meetings'],
    owner: ['owners', 'insurance'],
    tenant: ['tenants'],
    unit: ['units'],
    vendor: ['vendors'],
    violation: ['violations'],
  };

  if (!entityType) return false;
  return (namespaces[entityType.toLowerCase()] ?? [])
    .some((namespace) => isScopedStoragePath(value, namespace, entityId));
}

/** Signature references use one PNG object directly under the caller's uid. */
export function isSignatureStoragePath(
  value: unknown,
  expectedAuthUserId?: string | null,
): value is string {
  const segments = storageSegments(value);
  if (!segments || segments.length !== 3 || segments[0] !== 'signatures') return false;
  if (expectedAuthUserId && segments[1] !== expectedAuthUserId) return false;
  return /^\d{10,17}\.png$/i.test(segments[2]);
}
