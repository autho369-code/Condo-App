// Vendor document types that can be requested through an upload link.
// Keys match documents.doc_type and vendor_expiration_column() in the DB.

import { queueEmails } from '@/lib/email/queue';
import { tenantWorkspaceUrl } from '@/lib/tenant/host';

export const VENDOR_DOC_TYPES = [
  { value: 'w9', label: 'W-9 (taxpayer identification)', expires: false },
  { value: 'general_liability', label: 'General liability insurance certificate', expires: true },
  { value: 'workers_comp', label: 'Workers’ compensation certificate', expires: true },
  { value: 'auto_insurance', label: 'Auto insurance certificate', expires: true },
  { value: 'state_license', label: 'State / trade license', expires: true },
  { value: 'epa_certification', label: 'EPA certification', expires: true },
  { value: 'contract', label: 'Signed contract', expires: true },
  { value: 'other', label: 'Other document', expires: false },
] as const;
export type VendorDocType = (typeof VENDOR_DOC_TYPES)[number]['value'];

export const vendorDocLabel = (v: string) => VENDOR_DOC_TYPES.find((d) => d.value === v)?.label ?? v.replace(/_/g, ' ');
export const vendorDocExpires = (v: string) => VENDOR_DOC_TYPES.find((d) => d.value === v)?.expires ?? false;
export const isVendorDocType = (v: string): v is VendorDocType => VENDOR_DOC_TYPES.some((d) => d.value === v);

export const LINK_DAYS = 30;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function firstVendorEmail(emails: unknown): string | null {
  const list = Array.isArray(emails) ? emails : [];
  for (const e of list) {
    const v = typeof e === 'string' ? e : (e as any)?.email;
    if (typeof v === 'string' && EMAIL_RE.test(v.trim())) return v.trim();
  }
  return null;
}

export async function emailVendorRequest(svc: any, opts: {
  to: string; vendorName: string; companyName: string; docType: string; message?: string | null;
  dueDate?: string | null; token: string; portfolioId: string; requestId: string; attempt: string; reason?: string | null;
}) {
  // The link opens on the company's own address, so the upload page carries
  // its name (falls back to the platform address if the lookup fails).
  const { data: company } = await svc.from('portfolios').select('slug').eq('id', opts.portfolioId).maybeSingle();
  const link = tenantWorkspaceUrl(company?.slug ?? null, `/vendor-upload/${opts.token}`);
  const label = vendorDocLabel(opts.docType);
  const lines = [
    `Hello ${opts.vendorName},`,
    '',
    opts.reason
      ? `${opts.companyName} could not accept the ${label} you sent: ${opts.reason}`
      : `${opts.companyName} is requesting your ${label}.`,
    opts.message ? `\n${opts.message}` : '',
    '',
    `Upload it here (no login needed; the link works for ${LINK_DAYS} days):`,
    link,
    opts.dueDate ? `\nPlease send it by ${opts.dueDate}.` : '',
    '',
    'Thank you.',
  ].filter((l) => l !== '');
  return queueEmails(svc, [{
    to: opts.to,
    subject: opts.reason ? `Please resend: ${label}` : `Document request: ${label}`,
    text: lines.join('\n'),
    portfolioId: opts.portfolioId,
    fromName: opts.companyName,
    idempotencyKey: `vendor-doc-request:${opts.requestId}:${opts.attempt}`,
  }]);
}
