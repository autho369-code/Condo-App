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

// Vendor phone lists are mostly plain strings (["773-555-0100"]); some rows
// carry objects ({ number | value, type }). Read both shapes, and when the
// first number is edited keep whatever shape is already stored.

type PhoneEntry = string | { number?: unknown; value?: unknown; type?: unknown } | null | undefined;

/** The phone number held by one stored entry, or '' when it has none. */
export function phoneEntryValue(p: unknown): string {
  const e = p as PhoneEntry;
  const raw = typeof e === 'string' ? e : e && typeof e === 'object' ? (e.number ?? e.value) : '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/** The first stored phone number, or '' when there is none. */
export function firstVendorPhone(list: unknown): string {
  return Array.isArray(list) && list.length ? phoneEntryValue(list[0]) : '';
}

/**
 * Replace (or, with an empty value, remove) the first phone entry, keeping
 * every other entry and the stored shape of the first one.
 */
export function replaceFirstVendorPhone(list: unknown, value: string): unknown[] {
  const phones = Array.isArray(list) ? [...list] : [];
  const v = value.trim();
  if (!v) {
    phones.splice(0, 1);
    return phones;
  }
  const first = phones[0] as PhoneEntry;
  if (first && typeof first === 'object') {
    const key = typeof first.value === 'string' && typeof first.number !== 'string' ? 'value' : 'number';
    phones[0] = { ...first, [key]: v };
  } else {
    phones[0] = v;
  }
  return phones;
}
