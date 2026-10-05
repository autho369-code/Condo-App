/**
 * Safe summaries of Plaid SDK (axios) errors.
 *
 * A raw axios error carries `config.headers` (PLAID-CLIENT-ID / PLAID-SECRET)
 * and `config.data` (the access_token or public_token being exchanged), so it
 * must never be logged or returned whole. These helpers keep only Plaid's
 * documented, non-secret error fields.
 */
export interface PlaidErrorSummary {
  status: number | null;
  error_type: string | null;
  error_code: string | null;
  error_message: string | null;
  request_id: string | null;
}

function text(value: unknown, max = 300): string | null {
  return typeof value === 'string' && value ? value.slice(0, max) : null;
}

export function plaidErrorSummary(error: unknown): PlaidErrorSummary {
  const e = (error ?? {}) as any;
  const data = e?.response?.data ?? {};
  return {
    status: typeof e?.response?.status === 'number' ? e.response.status : null,
    error_type: text(data.error_type, 80),
    error_code: text(data.error_code, 80),
    error_message: text(data.error_message) ?? (e?.response ? null : text(e?.message)),
    request_id: text(data.request_id, 80),
  };
}

/** A message that is safe to show the signed-in staff user. */
export function plaidPublicMessage(error: unknown, fallback: string): string {
  const s = plaidErrorSummary(error);
  return s.error_message ?? fallback;
}
