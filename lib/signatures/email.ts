import 'server-only';
import type { QueuedEmail } from '@/lib/email/queue';
import { siteUrl } from '@/lib/url/site-url';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shell(body: string) {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">${body}<p style="margin-top:28px;font-size:12px;color:#6b7280">Sent through Portier369 e-signature. If you did not expect this request, you can ignore this email.</p></div>`;
}

export function signingLink(token: string) {
  return `${siteUrl()}/sign/${token}`;
}

export function signatureRequestEmail(args: {
  to: string; toName: string; title: string; company: string | null; message: string | null;
  token: string; expiresAt: string; portfolioId: string; associationId: string | null; idempotencyKey: string; reminder?: boolean;
}): QueuedEmail {
  const link = signingLink(args.token);
  const expires = new Date(args.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const from = args.company ?? 'Your management company';
  return {
    to: args.to,
    toName: args.toName,
    subject: `${args.reminder ? 'Reminder: ' : ''}Signature requested — ${args.title}`,
    html: shell(`
      <p>Hello ${esc(args.toName)},</p>
      <p>${esc(from)} has asked you to review and sign <strong>${esc(args.title)}</strong>.</p>
      ${args.message ? `<p style="padding:12px 14px;background:#f6f7f9;border-radius:10px">${esc(args.message)}</p>` : ''}
      <p><a href="${link}" style="display:inline-block;background:#030712;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Review and sign</a></p>
      <p style="font-size:13px;color:#6b7280">This personal link expires ${esc(expires)}. Do not forward it — anyone with the link can sign as you.</p>`),
    portfolioId: args.portfolioId,
    associationId: args.associationId,
    idempotencyKey: args.idempotencyKey,
  };
}

export function signatureCompletedEmail(args: {
  to: string; toName: string; title: string; sha256: string; portfolioId: string; associationId: string | null; idempotencyKey: string; staffLink?: string;
}): QueuedEmail {
  return {
    to: args.to,
    toName: args.toName,
    subject: `Completed — ${args.title}`,
    html: shell(`
      <p>Hello ${esc(args.toName)},</p>
      <p>Everyone has signed <strong>${esc(args.title)}</strong>.</p>
      ${args.staffLink
        ? `<p><a href="${args.staffLink}">View the completed document and signature record</a></p>`
        : '<p>Open the signing link from your original email to view or download the completed document and its signature record.</p>'}
      <p style="font-size:12px;color:#6b7280">Document fingerprint (SHA-256): <code>${esc(args.sha256)}</code></p>`),
    portfolioId: args.portfolioId,
    associationId: args.associationId,
    idempotencyKey: args.idempotencyKey,
  };
}
