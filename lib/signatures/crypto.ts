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
export const MAX_SIGNATURE_PDF_BYTES = 10 * 1024 * 1024;

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}
