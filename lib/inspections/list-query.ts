// Search on the staff inspections list. The matching runs in the database
// (inspection_search, migration 20261015110000): the inspection type, the
// association name, unit number, inspector name and the staff-only notes,
// under the caller's row-level security.

/**
 * The search text, cleaned: characters with a special meaning in filters or
 * LIKE are dropped, spaces collapsed, at most 100 characters.
 */
export function inspectionSearchTerm(q: string | null | undefined): string {
  return String(q ?? '')
    .replace(/[,()*%_\\"'.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}
