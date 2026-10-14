// Pure helpers for the owner portal's payment history (ledger, dashboard,
// timeline, ledger export). No server-only imports: the export component
// runs in the browser.

type PaymentLike = { method?: string | null; reference?: string | null };

/**
 * A removed late fee is booked as a homeowner credit (payments.method
 * 'credit', reference 'Late fee removed'). It lowers the balance but is not
 * money the owner paid, so it must never read as a payment received.
 */
export function isLateFeeRemoval(p: PaymentLike): boolean {
  return String(p.method ?? '').toLowerCase() === 'credit'
    && String(p.reference ?? '').trim().toLowerCase().startsWith('late fee removed');
}

/** The method label an owner sees: "Late fee removed" for those credits. */
export function ownerPaymentMethodLabel(p: PaymentLike, fallback = 'payment'): string {
  if (isLateFeeRemoval(p)) return 'Late fee removed';
  const method = String(p.method ?? '').trim();
  return method ? method.replace(/_/g, ' ') : fallback;
}

/**
 * Splits export rows by association (one header per association) in the
 * order the associations first appear. Rows without an association go under
 * `fallback`.
 */
export function groupByAssociation<C extends { association?: string }, P extends { association?: string }>(
  charges: C[],
  payments: P[],
  fallback: string,
): { association: string; charges: C[]; payments: P[] }[] {
  const groups = new Map<string, { association: string; charges: C[]; payments: P[] }>();
  const group = (name: string | undefined) => {
    const key = name?.trim() || fallback;
    let g = groups.get(key);
    if (!g) { g = { association: key, charges: [], payments: [] }; groups.set(key, g); }
    return g;
  };
  for (const c of charges) group(c.association).charges.push(c);
  for (const p of payments) group(p.association).payments.push(p);
  if (groups.size === 0) groups.set(fallback, { association: fallback, charges: [], payments: [] });
  return [...groups.values()];
}
