import 'server-only';

// One-time form tokens (public.form_submissions). The page renders a fresh
// token into a hidden field; the action claims it right before writing, so a
// double click or a re-sent form cannot record the same thing twice.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SUBMISSION_FIELD = 'submission_token';

export function newSubmissionToken(): string {
  return crypto.randomUUID();
}

export type SubmissionClaim =
  | { status: 'claimed'; token: string }
  | { status: 'duplicate'; resultId: string | null }
  | { status: 'error'; message: string };

/** Claim the form's token. `duplicate` means this form was already submitted. */
export async function claimSubmission(db: any, formData: FormData, kind: string): Promise<SubmissionClaim> {
  const token = String(formData.get(SUBMISSION_FIELD) ?? '');
  if (!UUID.test(token)) return { status: 'error', message: 'This form expired. Reload the page and try again.' };
  const { error } = await db.from('form_submissions').insert({ token, kind });
  if (!error) return { status: 'claimed', token };
  if (error.code === '23505') {
    const { data } = await db.from('form_submissions').select('result_id').eq('token', token).maybeSingle();
    return { status: 'duplicate', resultId: data?.result_id ?? null };
  }
  return { status: 'error', message: error.message ?? 'The form could not be submitted.' };
}

/** Record what the submission created, so a repeat can point to it. */
export async function completeSubmission(db: any, token: string, resultId: string): Promise<void> {
  await db.from('form_submissions').update({ result_id: resultId }).eq('token', token);
}

/** Release a claim when the write failed, so the same form can be retried. */
export async function releaseSubmission(db: any, token: string): Promise<void> {
  await db.from('form_submissions').delete().eq('token', token);
}

/**
 * Deterministic token for content-keyed submissions (e.g. an uploaded file):
 * the same content claims the same token, so it cannot be imported twice.
 */
export async function contentSubmissionToken(...parts: string[]): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\u0000'))));
  const hex = Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
