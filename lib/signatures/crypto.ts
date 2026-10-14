import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

/** 256-bit URL-safe signing token. Only its SHA-256 is stored. */
export function newSigningToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashSigningToken(token) };
}

export function hashSigningToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Tokens are 43 base64url chars; reject anything else before touching the DB. */
export function isWellFormedToken(token: string | undefined | null): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function sha256Hex(data: Buffer | Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export const SIGNATURE_BUCKET = 'association-documents';
// The PDF travels in the server action's request body, which Vercel caps at
// about 4.5 MB (with the other form fields), so the file itself stays under 4 MB.
export const MAX_SIGNATURE_PDF_BYTES = 4 * 1024 * 1024;

/**
 * A signer may read the document while the request is open and it's not
 * blocked for them (expired, or waiting for an earlier signer), or once it is
 * completed if they signed. Never for a voided or declined request.
 */
export function canReadSignedDocument(requestStatus: string, blocked: string | null | undefined, signerStatus: string): boolean {
  if (requestStatus === 'sent') return !blocked;
  if (requestStatus === 'completed') return signerStatus === 'signed';
  return false;
}

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

/** Why a signer can't sign right now, or null when they can. */
export function signingClosedReason(requestStatus: string | null | undefined, blocked: string | null | undefined): string | null {
  if (requestStatus === 'completed') return 'Everyone has already signed this document.';
  if (requestStatus === 'voided') return 'The sender cancelled this request.';
  if (requestStatus === 'declined') return 'This request was declined and is closed.';
  if (requestStatus !== 'sent') return 'This request is no longer open.';
  if (blocked === 'expired') return 'This request has expired. Ask the sender for a new one.';
  if (blocked === 'waiting') return "Another signer must sign before you. You'll get an email when it's your turn.";
  return null;
}
