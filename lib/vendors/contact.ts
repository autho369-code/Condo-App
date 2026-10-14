// Vendor email lists are stored as plain strings (["ap@acme.com"]); older
// imports used objects ({ email, type: 'work' }); an older profile form wrote
// { address }. Read every shape.

type EmailEntry = string | { email?: unknown; address?: unknown; type?: unknown; label?: unknown } | null | undefined;

function entryEmail(e: EmailEntry): string {
  if (typeof e === 'string') return e;
  if (!e || typeof e !== 'object') return '';
  if (typeof e.email === 'string' && e.email.trim()) return e.email;
  return typeof e.address === 'string' ? e.address : '';
}

/** Every usable email on a vendor, in stored order, trimmed. */
export function vendorEmails(emails: unknown): string[] {
  if (!Array.isArray(emails)) return [];
  const out: string[] = [];
  for (const e of emails as EmailEntry[]) {
    const v = entryEmail(e).trim();
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

/** The email held by the first stored entry, or '' when there is none. */
export function firstVendorEmail(emails: unknown): string {
  if (!Array.isArray(emails) || !emails.length) return '';
  return entryEmail(emails[0] as EmailEntry).trim();
}

/**
 * Replace (or, with an empty value, remove) the first email entry, keeping
 * every other entry and the stored shape of the first one. Returns null when
 * removing it would leave no email on file.
 */
export function replaceFirstVendorEmail(list: unknown, value: string): unknown[] | null {
  const emails = Array.isArray(list) ? [...list] : [];
  const v = value.trim();
  if (!v) {
    emails.splice(0, 1);
    return emails.length === 0 ? null : emails;
  }
  const first = emails[0] as EmailEntry;
  if (first && typeof first === 'object') {
    const { address: _address, ...rest } = first as Record<string, unknown>;
    emails[0] = { ...rest, email: v };
  } else {
    emails[0] = v;
  }
  return emails;
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
