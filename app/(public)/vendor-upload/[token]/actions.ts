'use server';
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { queueEmails } from '@/lib/email/queue';
import { consumePublicRateLimit } from '@/lib/server/rate-limit';
import { hashSigningToken, isWellFormedToken } from '@/lib/signatures/crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { COMPANY_ADDRESS_COLUMNS, companyUrl } from '@/lib/tenant/host';
import { tokenMatchesAddress } from '@/lib/tenant/token-company';
import { vendorDocExpires, vendorDocLabel } from '@/lib/vendors/document-requests';

// Public, token-authenticated upload. The token is the only credential; it is
// verified inside service-role-only functions, and every call is rate limited.

const BUCKET = 'association-documents';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['pdf', 'png', 'jpg', 'jpeg', 'heic', 'webp', 'doc', 'docx']);

function back(token: string, key: 'error' | 'done', msg: string): never {
  redirect(`/vendor-upload/${token}?${key}=${encodeURIComponent(msg)}`);
}

export async function submitVendorUpload(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  if (!isWellFormedToken(token)) redirect('/vendor-upload/invalid');
  const svc = createServiceClient() as any;
  const h = await headers();
  const limit = await consumePublicRateLimit(svc, h, { scope: 'vendor_upload_action', windowSeconds: 600, maxRequests: 10 });
  if (!limit.allowed) back(token, 'error', 'Too many attempts. Please wait a few minutes and try again.');

  const hash = hashSigningToken(token);
  const { data: session } = await svc.rpc('vendor_request_session', { p_token_hash: hash });
  // A token from another company is not valid on this company's address.
  if (!session || !tokenMatchesAddress(h, session.portfolio_id)) back(token, 'error', 'This upload link is not valid.');

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) back(token, 'error', 'Choose the file to upload.');
  if (file.size > MAX_BYTES) back(token, 'error', 'Files must be 10 MB or smaller.');
  const safeName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  const ext = safeName.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED.has(ext)) back(token, 'error', 'Upload a PDF, image, or Word document.');
  const expiresOn = String(formData.get('expires_on') ?? '').trim() || null;
  if (vendorDocExpires(session.doc_type) && !expiresOn) back(token, 'error', 'Enter the expiration date shown on the document.');
  if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) back(token, 'error', 'Enter a valid expiration date.');

  const path = `vendors/${session.vendor_id}/compliance/${randomUUID()}-${safeName}`;
  const { error: upErr } = await svc.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (upErr) back(token, 'error', 'The upload failed. Please try again.');

  const { error } = await svc.rpc('submit_vendor_request_upload', {
    p_token_hash: hash, p_path: path, p_file_name: file.name, p_expires_on: expiresOn,
  });
  if (error) {
    await svc.storage.from(BUCKET).remove([path]);
    back(token, 'error', error.message);
  }

  // Tell whoever asked for it.
  if (session.requested_by) {
    const { data: requester } = await svc.auth.admin.getUserById(session.requested_by);
    const to = requester?.user?.email;
    if (to) {
      const { data: company } = await svc.from('portfolios').select(COMPANY_ADDRESS_COLUMNS).eq('id', session.portfolio_id).maybeSingle();
      // Logged under the vendor's association (null only for the management
      // company). If the vendor cannot be read, skip the notice rather than log
      // it company-wide: the upload itself is saved and shows on the
      // compliance page.
      const { data: vendorRow, error: vendorError } = await svc.from('vendors').select('association_id, is_management_company').eq('id', session.vendor_id).maybeSingle();
      if (!vendorError && vendorRow && (vendorRow.association_id || vendorRow.is_management_company)) await queueEmails(svc, [{
        to,
        subject: `${session.vendor_name} sent their ${vendorDocLabel(session.doc_type)}`,
        text: `${session.vendor_name} uploaded the ${vendorDocLabel(session.doc_type)} you requested${expiresOn ? ` (expires ${expiresOn})` : ''}.\n\nReview it: ${companyUrl(company, '/vendors/compliance')}`,
        portfolioId: session.portfolio_id,
        associationId: vendorRow.association_id ?? null,
        idempotencyKey: `vendor-doc-submitted:${session.request_id}:${path}`,
      }]);
    }
  }
  back(token, 'done', 'Thank you — your document was received. You can close this page.');
}
