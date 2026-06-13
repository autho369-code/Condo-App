// Single source of truth for outbound email.
//
// Every email in the app is queued into `email_queue` and delivered by the
// `process-email-queue` cron → `send-email` edge function → Resend (key in
// Supabase Vault as `resend_api_key`). One Resend account serves every
// management company on the platform. Use this helper everywhere instead of
// hand-writing email_queue rows so columns and the verified sender stay
// consistent (email_queue has no `created_by` column — it is `sent_by`).

// Verified Resend senders on the portier369.com domain.
export const EMAIL_FROM = 'hello@portier369.com';
export const EMAIL_FROM_NOREPLY = 'noreply@portier369.com';
export const EMAIL_FROM_NAME = 'Portier369';

export interface QueuedEmail {
  to: string;
  toName?: string | null;
  subject: string;
  /** Pre-built HTML body. If omitted, `text` is escaped and wrapped. */
  html?: string;
  /** Plain text; converted to a safe HTML body when `html` is absent. */
  text?: string;
  portfolioId?: string | null;
  associationId?: string | null;
  fromAddress?: string;
  fromName?: string | null;
  replyTo?: string | null;
  noticeId?: string | null;
  templateId?: string | null;
  sentBy?: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function textToHtml(text: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;white-space:pre-wrap;line-height:1.6;color:#111827">${escapeHtml(text)}</div>`;
}

/** Build a single email_queue row with the correct columns + verified sender. */
export function emailQueueRow(e: QueuedEmail) {
  return {
    to_email: e.to,
    to_name: e.toName ?? null,
    subject: e.subject,
    body: e.html ?? textToHtml(e.text ?? ''),
    status: 'pending',
    from_address: e.fromAddress ?? EMAIL_FROM,
    from_name: e.fromName ?? EMAIL_FROM_NAME,
    reply_to: e.replyTo ?? null,
    portfolio_id: e.portfolioId ?? null,
    association_id: e.associationId ?? null,
    notice_id: e.noticeId ?? null,
    template_id: e.templateId ?? null,
    sent_by: e.sentBy ?? null,
  };
}

/**
 * Queue one or more emails for delivery. `db` is any Supabase client
 * (session, service, or admin). Returns the count queued and any error string.
 */
export async function queueEmails(db: any, emails: QueuedEmail[]): Promise<{ error: string | null; count: number }> {
  if (!emails.length) return { error: null, count: 0 };
  const rows = emails.map(emailQueueRow);
  const { error } = await db.from('email_queue').insert(rows);
  return { error: error?.message ?? null, count: error ? 0 : rows.length };
}
