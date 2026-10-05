// Vendor email lists are stored as plain strings (["ap@acme.com"]); older
// imports used objects ({ email, type: 'work' }). Read both shapes.

type EmailEntry = string | { email?: unknown; type?: unknown; label?: unknown } | null | undefined;

/** Every usable email on a vendor, in stored order, trimmed. */
export function vendorEmails(emails: unknown): string[] {
  if (!Array.isArray(emails)) return [];
  const out: string[] = [];
  for (const e of emails as EmailEntry[]) {
    const raw = typeof e === 'string' ? e : e && typeof e === 'object' && typeof e.email === 'string' ? e.email : '';
    const v = raw.trim();
    if (v.includes('@')) out.push(v);
  }
  return out;
}

/** The vendor's work email when one is labelled, otherwise the first one. */
export function primaryVendorEmail(emails: unknown): string | null {
  if (!Array.isArray(emails)) return null;
  const work = (emails as EmailEntry[]).find((e) => !!e && typeof e === 'object' && (e.type === 'work' || e.label === 'work'));
  const labelled = work ? vendorEmails([work])[0] : undefined;
  return labelled ?? vendorEmails(emails)[0] ?? null;
}
