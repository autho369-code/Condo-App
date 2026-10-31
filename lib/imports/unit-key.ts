/**
 * The key every import matches unit numbers by: case-insensitive, ignoring
 * spacing around dashes ("3817 - 1" = "3817-1") and repeated spaces. Shared
 * by the CSV owner import, the previous-system homeowner, unit and
 * open-balance imports, so a unit one of them created is found by the others.
 */
export function importUnitKey(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  return s.toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
}
