import { describe, expect, it } from 'vitest';
import {
  CLIENT_BUNDLE_RECOVERY_KEY,
  CLIENT_BUNDLE_RECOVERY_WINDOW_MS,
  isRecoverableClientBundleError,
  shouldReloadForClientBundleError,
} from '@/lib/errors/client-bundle-recovery';

function storageWith(value: string | null = null) {
  let stored = value;
  return {
    getItem: () => stored,
    setItem: (_key: string, next: string) => { stored = next; },
    value: () => stored,
  };
}

describe('client bundle recovery', () => {
  it.each([
    new Error('Loading chunk 1613 failed'),
    new Error('Failed to fetch dynamically imported module'),
    Object.assign(new Error('request failed'), { name: 'ChunkLoadError' }),
    new Error("Unexpected token '<'"),
  ])('recognizes stale deployment bundle failures', (error) => {
    expect(isRecoverableClientBundleError(error)).toBe(true);
  });

  it('does not reload for ordinary application errors', () => {
    expect(isRecoverableClientBundleError(new Error('Invalid association state'))).toBe(false);
  });

  it('records the first recovery attempt', () => {
    const storage = storageWith();
    expect(shouldReloadForClientBundleError(new Error('Loading chunk 42 failed'), storage, 10_000)).toBe(true);
    expect(storage.value()).toBe('10000');
  });

  it('prevents a reload loop inside the recovery window', () => {
    const now = 100_000;
    const storage = storageWith(String(now - CLIENT_BUNDLE_RECOVERY_WINDOW_MS + 1));
    expect(shouldReloadForClientBundleError(new Error('ChunkLoadError'), storage, now)).toBe(false);
  });

  it('allows another recovery after the window expires', () => {
    const now = 100_000;
    const storage = storageWith(String(now - CLIENT_BUNDLE_RECOVERY_WINDOW_MS));
    expect(shouldReloadForClientBundleError(new Error('ChunkLoadError'), storage, now)).toBe(true);
    expect(storage.value()).toBe(String(now));
  });

  it('uses the stable session storage key', () => {
    expect(CLIENT_BUNDLE_RECOVERY_KEY).toBe('portier369:client-bundle-recovery');
  });
});
