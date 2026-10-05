// owners/vendors.phone_numbers is jsonb holding either objects
// ({ number, type|label }) or plain strings, depending on how the record was
// created or imported. Read both shapes everywhere a phone list is used.

export type PhoneEntry = { number: string; type: string | null };

/** Normalize a phone_numbers jsonb value into { number, type } entries (empty numbers dropped). */
export function phoneEntries(phoneNumbers: unknown): PhoneEntry[] {
  if (!Array.isArray(phoneNumbers)) return [];
  const out: PhoneEntry[] = [];
  for (const p of phoneNumbers) {
    const number = typeof p === 'string' ? p : typeof p?.number === 'string' ? p.number : '';
    if (!number.trim()) continue;
    const type = typeof p === 'string' ? null : (typeof p?.type === 'string' ? p.type : typeof p?.label === 'string' ? p.label : null);
    out.push({ number: number.trim(), type });
  }
  return out;
}

/** Just the numbers from a phone_numbers jsonb value. */
export function phoneNumberList(phoneNumbers: unknown): string[] {
  return phoneEntries(phoneNumbers).map((p) => p.number);
}
