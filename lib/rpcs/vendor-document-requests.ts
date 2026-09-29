'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { newSigningToken } from '@/lib/signatures/crypto';
import { EMAIL_RE, LINK_DAYS, emailVendorRequest, firstVendorEmail, isVendorDocType, vendorDocLabel } from '@/lib/vendors/document-requests';

// Staff actions. Requests are created with the staff member's own session
// (RLS: can_access_portfolio); upload-link hashes live in a service-role-only
// table. Only the SHA-256 of each link token is stored.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
function go(path: string, key: 'error' | 'saved', msg: string): never {
  revalidatePath('/vendors/compliance');
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
}
const backTo = (fd: FormData) => (s(fd, 'back') === 'forms' ? '/vendors/forms' : '/vendors/compliance');

async function issueLink(svc: any, requestId: string, to: string) {
  const { token, hash } = newSigningToken();
  const { error } = await svc.from('document_request_links').upsert({
    request_id: requestId, token_hash: hash, sent_to: to, last_sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + LINK_DAYS * 86400000).toISOString(),
  }, { onConflict: 'request_id' });
  if (error) throw new Error(`Could not create the upload link: ${error.message}`);
  return token;
}

export async function requestVendorDocument(formData: FormData) {
  const me = await requireStaff();
  const to = backTo(formData);
  const vendorId = s(formData, 'vendor_id');
  const docType = s(formData, 'doc_type');
  if (!UUID_RE.test(vendorId)) go(to, 'error', 'Choose a vendor.');
  if (!isVendorDocType(docType)) go(to, 'error', 'Choose the document to request.');
  const dueDate = s(formData, 'due_date') || null;
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) go(to, 'error', 'Enter a valid due date.');
  const message = s(formData, 'message').slice(0, 2000) || null;

  const db = (await createClient()) as any;
  const { data: vendor } = await db.from('vendors').select('id, name, emails, portfolio_id, portfolios(company_name)').eq('id', vendorId).is('archived_at', null).maybeSingle();
  if (!vendor) go(to, 'error', 'Vendor not found.');
  const email = s(formData, 'email') || firstVendorEmail(vendor.emails);
  if (!email || !EMAIL_RE.test(email)) go(to, 'error', `${vendor.name} has no email address. Enter one to send the request.`);

  const { data: request, error } = await db.from('document_requests').insert({
    portfolio_id: vendor.portfolio_id, vendor_id: vendor.id, doc_type: docType, name: vendorDocLabel(docType),
    description: message, due_date: dueDate, requested_by: me.auth_user_id, status: 'requested', notes: `Emailed to ${email}`,
  }).select('id').single();
  if (error) go(to, 'error', error.message);

  const svc = createServiceClient() as any;
  try {
    const token = await issueLink(svc, request.id, email);
    const { error: mailError } = await emailVendorRequest(svc, {
      to: email, vendorName: vendor.name, companyName: vendor.portfolios?.company_name ?? 'Your property manager',
      docType, message, dueDate, token, portfolioId: vendor.portfolio_id, requestId: request.id, attempt: 'initial',
    });
    if (mailError) throw new Error(mailError);
  } catch (e: any) {
    await db.from('document_requests').delete().eq('id', request.id);
    go(to, 'error', `The request was not sent: ${e?.message ?? 'email failed'}`);
  }
  go(to, 'saved', `Requested ${vendorDocLabel(docType)} from ${vendor.name} (emailed to ${email}).`);
}

export async function resendVendorRequest(formData: FormData) {
  await requireStaff();
  const to = backTo(formData);
  const db = (await createClient()) as any;
  const { data: r } = await db.from('document_requests')
    .select('id, doc_type, description, due_date, status, portfolio_id, vendors(name, emails, portfolios(company_name))')
    .eq('id', s(formData, 'request_id')).not('vendor_id', 'is', null).maybeSingle();
  if (!r) go(to, 'error', 'Request not found.');
  if (!['requested', 'in_progress', 'rejected'].includes(r.status)) go(to, 'error', 'This request has already been answered.');
  const email = firstVendorEmail(r.vendors?.emails);
  if (!email) go(to, 'error', 'The vendor has no email address.');
  const svc = createServiceClient() as any;
  try {
    const token = await issueLink(svc, r.id, email);
    const { error } = await emailVendorRequest(svc, {
      to: email, vendorName: r.vendors?.name ?? 'there', companyName: r.vendors?.portfolios?.company_name ?? 'Your property manager',
      docType: r.doc_type, message: r.description, dueDate: r.due_date, token, portfolioId: r.portfolio_id, requestId: r.id,
      attempt: `resend-${Date.now()}`,
    });
    if (error) throw new Error(error);
  } catch (e: any) {
    go(to, 'error', e?.message ?? 'Could not resend.');
  }
  go(to, 'saved', `Sent a fresh upload link to ${email}. Earlier links no longer work.`);
}

export async function reviewVendorDocument(formData: FormData) {
  await requireStaff();
  const to = backTo(formData);
  const approve = s(formData, 'decision') === 'approve';
  const note = s(formData, 'note') || null;
  const db = (await createClient()) as any;
  const { error } = await db.rpc('review_vendor_document_request', {
    p_request_id: s(formData, 'request_id'), p_approve: approve, p_note: note, p_expires_on: s(formData, 'expires_on') || null,
  });
  if (error) go(to, 'error', error.message);

  if (!approve) {
    // Ask again with a fresh link and the reason.
    const { data: r } = await db.from('document_requests')
      .select('id, doc_type, description, due_date, portfolio_id, vendors(name, emails, portfolios(company_name))')
      .eq('id', s(formData, 'request_id')).maybeSingle();
    const email = firstVendorEmail(r?.vendors?.emails);
    if (r && email) {
      const svc = createServiceClient() as any;
      const token = await issueLink(svc, r.id, email);
      const { error: mailError } = await emailVendorRequest(svc, {
        to: email, vendorName: r.vendors?.name ?? 'there', companyName: r.vendors?.portfolios?.company_name ?? 'Your property manager',
        docType: r.doc_type, message: r.description, dueDate: r.due_date, token, portfolioId: r.portfolio_id, requestId: r.id,
        attempt: `rejected-${Date.now()}`, reason: note,
      });
      if (mailError) go(to, 'error', `Marked as not accepted, but the email to the vendor failed: ${mailError}`);
      go(to, 'saved', `Not accepted. ${r.vendors?.name ?? 'The vendor'} was emailed the reason and a new upload link.`);
    }
    go(to, 'saved', 'Not accepted. The vendor has no email address, so contact them directly.');
  }
  go(to, 'saved', 'Document approved and the vendor’s compliance dates updated.');
}
