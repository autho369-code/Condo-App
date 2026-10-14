/**
 * Pick the work order a "used on work order #N" entry means. Numbers aren't
 * unique, so the caller looks only inside the item's company (limit 2) and a
 * number that still matches more than one work order is refused.
 */
export function workOrderMatch(
  matches: ReadonlyArray<{ id: string }> | null | undefined,
  number: string,
): { id: string } | { error: string } {
  const rows = matches ?? [];
  if (rows.length === 0) return { error: `Work order #${number} not found.` };
  if (rows.length > 1) {
    return { error: `More than one work order is numbered #${number}. Choose the work order from the list instead.` };
  }
  return { id: rows[0].id };
}
