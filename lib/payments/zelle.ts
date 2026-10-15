// Zelle recipient an association gives owners: an email address or a US
// mobile number. Must agree with associations_zelle_recipient_check
// (migration 20261017010000_zelle_owner_payments).

const EMAIL = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const US_PHONE = /^[2-9][0-9]{2}[2-9][0-9]{6}$/;

export type ZelleRecipientResult = { ok: true; value: string | null } | { ok: false; error: string };

/** Blank clears it; an email is kept as typed (trimmed); a phone is stored as 10 digits. */
export function normalizeZelleRecipient(input: string | null | undefined): ZelleRecipientResult {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: true, value: null };
  if (raw.includes('@')) {
    return EMAIL.test(raw) && raw.length <= 254
      ? { ok: true, value: raw }
      : { ok: false, error: 'Enter the Zelle email address, for example payments@yourassociation.com.' };
  }
  if (/[^0-9+().\s-]/.test(raw)) {
    return { ok: false, error: 'Enter an email address or a US mobile number for Zelle.' };
  }
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return US_PHONE.test(digits)
    ? { ok: true, value: digits }
    : { ok: false, error: 'Enter a 10-digit US mobile number for Zelle.' };
}

/** A stored recipient as owners read it: (312) 555-0100 for a phone. */
export function formatZelleRecipient(value: string | null | undefined): string {
  const v = String(value ?? '').trim();
  const digits = v.replace(/^\+?1(?=\d{10}$)/, '');
  if (/^\d{10}$/.test(digits)) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return v;
}
