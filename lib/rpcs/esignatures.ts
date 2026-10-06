'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { queueEmails } from '@/lib/email/queue';
import { MAX_SIGNATURE_PDF_BYTES, SIGNATURE_BUCKET, isPdf, newSigningToken, sha256Hex } from '@/lib/signatures/crypto';
import { signatureRequestEmail } from '@/lib/signatures/email';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';

const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
const SUBJECT_TYPES = ['document', 'architectural_request', 'board_resolution', 'vendor_agreement', 'management_agreement', 'year_end_package'];

function fail(path: string, msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`);
}

type SignerInput = { name: string; email: string; role_label?: string };

export async function createSignatureRequest(formData: FormData) {
  const me = await requireStaff(); // create_signature_request re-checks portfolio + association scope
  const back = '/signatures/new';
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) fail(back, 'Your account is not linked to a portfolio.');

  const title = s(formData, 'title');
  const subjectType = SUBJECT_TYPES.includes(s(formData, 'subject_type')) ? s(formData, 'subject_type') : 'document';
  const subjectId = /^[0-9a-f-]{36}$/i.test(s(formData, 'subject_id')) ? s(formData, 'subject_id') : null;
  const associationId = s(formData, 'association_id') || null;
  const kind = s(formData, 'document_kind') === 'pdf' ? 'pdf' : 'text';
  const expiresDays = Number(s(formData, 'expires_days') || 30);

  let signers: SignerInput[] = [];
  try {
    signers = JSON.parse(s(formData, 'signers') || '[]');
  } catch {
    fail(back, 'Could not read the signer list.');
  }
  signers = (Array.isArray(signers) ? signers : [])
    .map((x) => ({ name: String(x?.name ?? '').trim(), email: String(x?.email ?? '').trim().toLowerCase(), role_label: String(x?.role_label ?? '').trim() }))
    .filter((x) => x.name || x.email);
  if (signers.length === 0) fail(back, 'Add at least one signer.');
  if (signers.some((x) => x.name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email))) fail(back, 'Every signer needs a name and a valid email.');
  if (new Set(signers.map((x) => x.email)).size !== signers.length) fail(back, 'Each signer needs a different email address.');

  const service = createServiceClient() as any;
  let documentPath: string | null = null;
  let bodyText: string | null = null;
  let pdfBytes: Uint8Array | null = null;
  let sha: string;

  if (kind === 'pdf') {
    const file = formData.get('document');
    if (!(file instanceof File) || file.size === 0) fail(back, 'Attach the PDF to be signed.');
    if (file.size > MAX_SIGNATURE_PDF_BYTES) fail(back, 'PDFs are limited to 10 MB.');
    pdfBytes = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(pdfBytes)) fail(back, 'The attached file is not a PDF.');
    sha = sha256Hex(pdfBytes);
  } else {
    bodyText = s(formData, 'body_text').replace(/\r\n/g, '\n');
    if (bodyText.length < 20) fail(back, 'Write the text to be signed (at least 20 characters).');
    sha = sha256Hex(bodyText);
  }

  // A double click or a re-sent form must not create (and email) the request twice.
  const supabase = await createClient();
  const db = supabase as any;
  const claim = await claimSubmission(db, formData, 'signature_request');
  if (claim.status === 'error') fail(back, claim.message);
  if (claim.status === 'duplicate') {
    redirect(claim.resultId ? `/signatures/${claim.resultId}?saved=${encodeURIComponent('This request was already sent.')}` : '/signatures');
  }
  const submissionToken = (claim as { token: string }).token;
  const failReleased = async (msg: string): Promise<never> => {
    await releaseSubmission(db, submissionToken);
    return fail(back, msg);
  };

  if (pdfBytes) {
    documentPath = `signatures/${portfolioId}/${randomUUID()}.pdf`;
    const { error: uploadError } = await service.storage.from(SIGNATURE_BUCKET).upload(documentPath, pdfBytes, { contentType: 'application/pdf', upsert: false });
    if (uploadError) await failReleased(`Upload failed: ${uploadError.message}`);
  }

  const withTokens = signers.map((x) => ({ ...x, ...newSigningToken() }));
  const { data: requestId, error } = await db.rpc('create_signature_request', {
    p_portfolio_id: portfolioId,
    p_association_id: associationId,
    p_subject_type: subjectType,
    p_subject_id: subjectId,
    p_title: title,
    p_message: s(formData, 'message') || null,
    p_document_kind: kind,
    p_document_path: documentPath,
    p_body_text: bodyText,
    p_document_sha256: sha,
    p_signers: withTokens.map(({ name, email, role_label, hash }) => ({ name, email, role_label, token_hash: hash })),
    p_expires_days: expiresDays,
    p_sequential: formData.get('sequential') === 'on',
  });
  if (error) {
    if (documentPath) await service.storage.from(SIGNATURE_BUCKET).remove([documentPath]);
    await failReleased(error.message);
  }
  await completeSubmission(db, submissionToken, requestId);

  // Sequential requests email only the first signer now; the rest are
  // emailed as each prior signer completes (see the public sign action).
  const sequential = formData.get('sequential') === 'on';
  const expiresAt = new Date(Date.now() + expiresDays * 86400000).toISOString();
  const recipients = sequential ? withTokens.slice(0, 1) : withTokens;
  const { error: emailError } = await queueEmails(service, recipients.map((x, i) => signatureRequestEmail({
    to: x.email, toName: x.name, title, company: me.portfolio?.company_name ?? null, message: s(formData, 'message') || null,
    token: x.token, expiresAt, portfolioId: portfolioId!, associationId, idempotencyKey: `signature:${requestId}:${i}:initial`,
    workspaceSlug: me.portfolio?.slug,
  })));

  // Later signers in a sequential request get a freshly issued link when the
  // previous signer finishes; their initial token is never emailed or stored.
  revalidatePath('/signatures');
  redirect(`/signatures/${requestId}?saved=${encodeURIComponent(emailError ? `Request created, but email could not be queued: ${emailError}` : sequential ? 'Sent to the first signer. Others are emailed in order.' : `Sent to ${recipients.length} signer${recipients.length === 1 ? '' : 's'}.`)}`);
}

export async function voidSignatureRequest(formData: FormData) {
  await requireStaff();
  const id = s(formData, 'id');
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('void_signature_request', { p_id: id, p_reason: s(formData, 'reason') });
  if (error) fail(`/signatures/${id}`, error.message);
  revalidatePath('/signatures');
  redirect(`/signatures/${id}?saved=${encodeURIComponent('Request voided. Existing links no longer work.')}`);
}

export async function remindSigner(formData: FormData) {
  const me = await requireStaff();
  const id = s(formData, 'request_id');
  const signerId = s(formData, 'signer_id');
  const { token, hash } = newSigningToken();
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('rotate_signature_signer_token', { p_signer_id: signerId, p_token_hash: hash });
  if (error) fail(`/signatures/${id}`, error.message);
  const { data: req } = await (supabase as any).from('signature_requests').select('portfolio_id, association_id').eq('id', id).maybeSingle();
  const { error: emailError } = await queueEmails(createServiceClient() as any, [signatureRequestEmail({
    to: data.email, toName: data.name, title: data.title, company: me.portfolio?.company_name ?? null, message: data.message,
    token, expiresAt: data.expires_at, portfolioId: req?.portfolio_id, associationId: req?.association_id ?? null,
    idempotencyKey: `signature:${id}:${signerId}:reminder:${hash.slice(0, 12)}`, reminder: true,
    workspaceSlug: me.portfolio?.slug,
  })]);
  if (emailError) fail(`/signatures/${id}`, `Link rotated but the email failed: ${emailError}`);
  redirect(`/signatures/${id}?saved=${encodeURIComponent(`Reminder sent to ${data.name} with a fresh link.`)}`);
}
