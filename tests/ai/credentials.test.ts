import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptAICredential, encryptAICredential } from '@/lib/ai/credentials';
import { chatCompletion } from '@/lib/ai/service';

describe('portfolio AI credential isolation', () => {
  beforeEach(() => {
    vi.stubEnv('AI_CREDENTIALS_ENCRYPTION_KEY', 'current-release-key-material-1234567890');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses authenticated randomized encryption and detects tampering', () => {
    const first = encryptAICredential('sk-portfolio-secret');
    const second = encryptAICredential('sk-portfolio-secret');
    expect(first).toMatch(/^v1:/);
    expect(first).not.toBe(second);
    expect(first).not.toContain('sk-portfolio-secret');
    expect(decryptAICredential(first)).toBe('sk-portfolio-secret');

    const tamperedParts = first.split(':');
    const tamperedCiphertext = Buffer.from(tamperedParts[3], 'base64url');
    tamperedCiphertext[0] ^= 1;
    tamperedParts[3] = tamperedCiphertext.toString('base64url');
    expect(() => decryptAICredential(tamperedParts.join(':'))).toThrow('Unable to decrypt');
  });

  it('can decrypt with the previous key during rotation', () => {
    const encrypted = encryptAICredential('sk-before-rotation');
    vi.stubEnv('AI_CREDENTIALS_ENCRYPTION_KEY', 'next-release-key-material-0987654321');
    vi.stubEnv('AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS', 'current-release-key-material-1234567890');
    expect(decryptAICredential(encrypted)).toBe('sk-before-rotation');
  });

  it('calls only the fixed provider URL and disables redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(chatCompletion(
      { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-provider-key' },
      [{ role: 'user', content: 'hello' }],
    )).resolves.toBe('ok');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.redirect).toBe('error');
    expect(init.cache).toBe('no-store');
  });

  it('rejects a runtime-injected custom provider before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatCompletion(
      { provider: 'custom', model: 'model', apiKey: 'secret-key' } as any,
      [{ role: 'user', content: 'hello' }],
    )).rejects.toThrow('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
