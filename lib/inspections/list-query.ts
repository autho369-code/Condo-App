// Search on the staff inspections list, run in the database: the inspection
// type, or the ids of associations, units, inspectors and (staff-only) notes
// that match the text.

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The search text made safe for a PostgREST filter: characters that the
 * filter syntax or LIKE treat specially are dropped, spaces collapsed, at
 * most 100 characters.
 */
export function inspectionSearchTerm(q: string | null | undefined): string {
  return String(q ?? '')
    .replace(/[,()*%_\\"'.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/** The PostgREST `or` filter for a search term and the matching related ids. */
export function inspectionSearchOr(
  term: string,
  matches: { associationIds: string[]; unitIds: string[]; vendorIds: string[]; inspectionIds: string[] },
): string {
  const ids = (list: string[]) => [...new Set(list.filter((id) => ID.test(id)))].join(',');
  const parts = [`inspection_type.ilike."*${term}*"`];
  const a = ids(matches.associationIds);
  const u = ids(matches.unitIds);
  const v = ids(matches.vendorIds);
  const n = ids(matches.inspectionIds);
  if (a) parts.push(`association_id.in.(${a})`);
  if (u) parts.push(`unit_id.in.(${u})`);
  if (v) parts.push(`inspector_vendor_id.in.(${v})`);
  if (n) parts.push(`id.in.(${n})`);
  return parts.join(',');
}
