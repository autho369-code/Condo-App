import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const FORMAT_VERSION = 'v1';
const AAD = Buffer.from('portier369:portfolio-ai-credential:v1', 'utf8');
const MIN_SECRET_LENGTH = 32;
const MAX_API_KEY_LENGTH = 4096;

function configuredSecrets(): string[] {
  const current = process.env.AI_CREDENTIALS_ENCRYPTION_KEY?.trim();
  const previous = process.env.AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS?.trim();
  const values = [current, previous].filter((value): value is string => !!value);

  if (!current || current.length < MIN_SECRET_LENGTH) {
    throw new Error('AI credential encryption is not configured.');
  }
  if (previous && previous.length < MIN_SECRET_LENGTH) {
    throw new Error('The previous AI credential encryption key is invalid.');
  }
  return [...new Set(values)];
}

function deriveKey(secret: string): Buffer {
  return createHash('sha256')
    .update('portier369:ai-credentials\0', 'utf8')
    .update(secret, 'utf8')
    .digest();
}

function decodePart(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encrypted credential.');
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) throw new Error('Invalid encrypted credential.');
  return decoded;
}

export function encryptAICredential(value: string): string {
  const plaintext = value.trim();
  if (plaintext.length < 8 || plaintext.length > MAX_API_KEY_LENGTH) {
    throw new Error('AI API keys must be between 8 and 4,096 characters.');
  }

  const [secret] = configuredSecrets();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    FORMAT_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptAICredential(value: string): string {
  const [version, ivPart, tagPart, ciphertextPart, extra] = value.split(':');
  if (version !== FORMAT_VERSION || !ivPart || !tagPart || !ciphertextPart || extra) {
    throw new Error('Invalid encrypted credential.');
  }

  const iv = decodePart(ivPart);
  const tag = decodePart(tagPart);
  const ciphertext = decodePart(ciphertextPart);
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error('Invalid encrypted credential.');
  }

  for (const secret of configuredSecrets()) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
      decipher.setAAD(AAD);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
      if (plaintext.length < 8 || plaintext.length > MAX_API_KEY_LENGTH) {
        throw new Error('Invalid encrypted credential.');
      }
      return plaintext;
    } catch {
      // Try the previous rotation key, when configured.
    }
  }

  // Keep failure timing independent of which configured key was closest.
  timingSafeEqual(createHash('sha256').update(ciphertext).digest(), Buffer.alloc(32));
  throw new Error('Unable to decrypt AI credential.');
}
