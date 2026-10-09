// Server-side checks that a form-supplied id belongs to the caller's own
// company (and, for scoped managers, their assigned associations).
//
// Several staff tables only check `portfolio_id` in RLS, so an insert that
// carries the caller's portfolio but ANOTHER company's association_id is
// accepted — and residents/board of that association can then read it, and
// SECURITY DEFINER triggers (calendar maintenance email/SMS) act on it. Every
// action that writes a form-supplied association_id must call this first.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** True only when the caller (RLS session client) manages this association. */
export async function managesAssociation(db: any, associationId: string | null | undefined): Promise<boolean> {
  if (!isUuid(associationId)) return false;
  const { data, error } = await db.rpc('can_manage_association', { p_association_id: associationId });
  return !error && data === true;
}

/**
 * The unit/building/vendor/owner ids a staff form attaches to a record must be
 * visible to the caller and (for units/buildings) inside the chosen
 * association. Returns an error message, or null when everything checks out.
 */
export async function checkLinkedRecords(
  db: any,
  input: {
    associationId: string | null;
    buildingId?: string | null;
    unitId?: string | null;
    vendorId?: string | null;
    ownerId?: string | null;
  },
): Promise<string | null> {
  const { associationId, buildingId, unitId, vendorId, ownerId } = input;
  for (const [label, id] of [['building', buildingId], ['unit', unitId], ['vendor', vendorId], ['owner', ownerId]] as const) {
    if (id && !isUuid(id)) return `The selected ${label} is not valid.`;
  }
  if ((buildingId || unitId) && !associationId) return 'Choose the association for this building or unit.';
  if (buildingId) {
    const { data } = await db.from('buildings').select('id').eq('id', buildingId).eq('association_id', associationId).maybeSingle();
    if (!data) return 'The selected building is not in this association.';
  }
  if (unitId) {
    const { data } = await db.from('units').select('id, buildings!inner(association_id)').eq('id', unitId)
      .eq('buildings.association_id', associationId).maybeSingle();
    if (!data) return 'The selected unit is not in this association.';
  }
  if (vendorId) {
    const { data } = await db.from('vendors').select('id, portfolio_id').eq('id', vendorId).maybeSingle();
    if (!data) return 'The selected vendor is unavailable or outside your access.';
    // Visible is not enough (platform operators see every company's vendors):
    // the vendor must be the association's company's.
    if (associationId) {
      const { data: assoc } = await db.from('associations').select('portfolio_id').eq('id', associationId).maybeSingle();
      if (!assoc || assoc.portfolio_id !== data.portfolio_id) return 'The selected vendor is not one of this association\'s company\'s vendors.';
    }
  }
  if (ownerId) {
    const { data } = await db.from('owners').select('id, association_id').eq('id', ownerId).maybeSingle();
    if (!data) return 'The selected owner is unavailable or outside your access.';
    // An owner has one record per association: it must be the chosen association's.
    if (associationId && data.association_id !== associationId) return 'The selected owner is not in this association.';
    // With no association chosen, the owner's own association must be one the
    // caller manages (owners are readable company-wide; platform operators
    // see every company's).
    if (!associationId && !(await managesAssociation(db, data.association_id))) {
      return 'The selected owner is in an association outside your access.';
    }
  }
  return null;
}
