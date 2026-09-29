'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { queueEmails } from '@/lib/email/queue';
import { clientAddress, consumePublicRateLimit } from '@/lib/server/rate-limit';
import { SIGNATURE_BUCKET, hashSigningToken, isWellFormedToken, newSigningToken, sha256Hex } from '@/lib/signatures/crypto';
import { signatureCompletedEmail, signatureRequestEmail } from '@/lib/signatures/email';
import { createServiceClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/url/site-url';

// Public, token-authenticated actions. Authorization is the token itself,
// verified inside SECURITY DEFINER functions that only the service role can
// call. Every call is rate limited per client address.

const SIGN_LIMIT = { scope: 'esign_action', windowSeconds: 600, maxRequests: 20 };

function back(token: string, key: 'error' | 'done', msg: string): never {
  redirect(`/sign/${token}?${key}=${encodeURIComponent(msg)}`);
}

async function context(token: string) {
  if (!isWellFormedToken(token)) redirect('/sign/invalid');
  const h = await headers();
  const service = createServiceClient() as any;
  const limit = await consumePublicRateLimit(service, h, SIGN_LIMIT);
  if (!limit.allowed) back(token, 'error', 'Too many attempts. Please wait a few minutes and try again.');
  return { service, ip: clientAddress(h), ua: (h.get('user-agent') ?? 'unknown').slice(0, 400), hash: hashSigningToken(token) };
}

/** Recompute the fingerprint from the stored bytes so a swapped file cannot be signed. */
async function currentDocumentHash(service: any, request: any): Promise<string | null> {
  if (request.document_kind === 'text') return sha256Hex(String(request.body_text ?? ''));
  const { data, error } = await service.storage.from(SIGNATURE_BUCKET).download(request.document_path);
  if (error || !data) return null;
  return sha256Hex(new Uint8Array(await data.arrayBuffer()));
}

export async function signDocument(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const { service, ip, ua, hash } = await context(token);
  const { data: session } = await service.rpc('signature_session', { p_token_hash: hash, p_ip: ip, p_user_agent: ua });
  if (!session) back(token, 'error', 'This signing link is not valid.');

  const docHash = await currentDocumentHash(service, session.request);
  if (!docHash) back(token, 'error', 'The document could not be verified. Please contact the sender.');

  const { data: result, error } = await service.rpc('sign_signature_request', {
    p_token_hash: hash,
    p_signature_name: String(formData.get('signature_name') ?? ''),
    p_consented: formData.get('consent') === 'on',
    p_document_sha256: docHash,
    p_ip: ip,
    p_user_agent: ua,
  });
  if (error) back(token, 'error', error.message);

  const requestId = result.request_id as string;
  const { data: req } = await service.from('signature_requests')
    .select('id, title, portfolio_id, association_id, document_sha256, sequential, created_by').eq('id', requestId).maybeSingle();

  if (result.completed && req) {
    const [{ data: signers }, creator] = await Promise.all([
      service.from('signature_signers').select('name, email').eq('request_id', requestId),
      req.created_by ? service.auth.admin.getUserById(req.created_by) : Promise.resolve({ data: null }),
    ]);
    const emails = (signers ?? []).map((sg: any, i: number) => signatureCompletedEmail({
      to: sg.email, toName: sg.name, title: req.title, sha256: req.document_sha256,
      portfolioId: req.portfolio_id, associationId: req.association_id, idempotencyKey: `signature:${requestId}:completed:${i}`,
    }));
    const creatorEmail = creator?.data?.user?.email;
    if (creatorEmail) {
      emails.push(signatureCompletedEmail({
        to: creatorEmail, toName: 'there', title: req.title, sha256: req.document_sha256,
        portfolioId: req.portfolio_id, associationId: req.association_id, idempotencyKey: `signature:${requestId}:completed:creator`,
        staffLink: `${siteUrl()}/signatures/${requestId}`,
      }));
    }
    await queueEmails(service, emails);
    back(token, 'done', 'Signed. Everyone has now signed — a completion notice is on its way.');
  }

  if (req?.sequential) {
    const next = newSigningToken();
    const { data: nextSigner } = await service.rpc('issue_next_signer_token', { p_request_id: requestId, p_token_hash: next.hash });
    if (nextSigner) {
      await queueEmails(service, [signatureRequestEmail({
        to: nextSigner.email, toName: nextSigner.name, title: nextSigner.title, company: nextSigner.company, message: nextSigner.message,
        token: next.token, expiresAt: nextSigner.expires_at, portfolioId: nextSigner.portfolio_id, associationId: nextSigner.association_id,
        idempotencyKey: `signature:${requestId}:${nextSigner.signer_id}:handoff`,
      })]);
    }
  }
  back(token, 'done', 'Signed. Thank you — the sender has been notified of your signature.');
}

export async function declineDocument(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const { service, ip, ua, hash } = await context(token);
  const reason = String(formData.get('reason') ?? '');
  const { data: session } = await service.rpc('signature_session', { p_token_hash: hash, p_ip: ip, p_user_agent: ua });
  const { error } = await service.rpc('decline_signature_request', {
    p_token_hash: hash, p_reason: reason, p_ip: ip, p_user_agent: ua,
  });
  if (error) back(token, 'error', error.message);

  // Tell the person who sent the request.
  const requestId = session?.request?.id as string | undefined;
  if (requestId) {
    const { data: req } = await service.from('signature_requests').select('title, portfolio_id, association_id, created_by').eq('id', requestId).maybeSingle();
    const creator = req?.created_by ? await service.auth.admin.getUserById(req.created_by) : null;
    const to = creator?.data?.user?.email;
    if (to) {
      await queueEmails(service, [{
        to,
        subject: `Declined — ${req.title}`,
        text: `${session.signer?.name ?? 'A signer'} declined to sign "${req.title}".\n\nReason: ${reason.trim().slice(0, 1000)}\n\nThe request is closed. Review it at ${siteUrl()}/signatures/${requestId}`,
        portfolioId: req.portfolio_id,
        associationId: req.association_id,
        idempotencyKey: `signature:${requestId}:declined`,
      }]);
    }
  }
  back(token, 'done', 'You declined to sign. The sender has been notified.');
}
