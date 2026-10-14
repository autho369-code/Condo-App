// Merge-field helpers for vendor bulk messages (/maintenance/communications).

/** "WO #123 — Leaking faucet" for one work order. */
export function workOrderRef(wo: { id: string; number?: string | number | null; title?: string | null }): string {
  return `WO #${wo.number ?? wo.id} — ${wo.title ?? 'Work order'}`;
}

/**
 * A vendor with several selected jobs gets every reference in {source_ref},
 * not just the first one (each listed once, in selection order).
 */
export function mergeSourceRef(current: string | null | undefined, ref: string): string {
  if (!current) return ref;
  return current.split('; ').includes(ref) ? current : `${current}; ${ref}`;
}
