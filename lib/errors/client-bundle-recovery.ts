export const CLIENT_BUNDLE_RECOVERY_KEY = 'portier369:client-bundle-recovery';
export const CLIENT_BUNDLE_RECOVERY_WINDOW_MS = 60_000;

const RECOVERABLE_BUNDLE_ERROR_PATTERNS = [
  /chunkloaderror/i,
  /loading (css )?chunk [\w-]+ failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /css_chunk_load_failed/i,
  /failed to load (?:module )?script/i,
  /unexpected token ['"]?</i,
];

type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem'>;

function errorText(error: unknown) {
  if (error instanceof Error) {
    return [error.name, error.message, error.stack].filter(Boolean).join('\n');
  }
  return String(error ?? '');
}

export function isRecoverableClientBundleError(error: unknown) {
  const text = errorText(error);
  return RECOVERABLE_BUNDLE_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export function shouldReloadForClientBundleError(
  error: unknown,
  storage: RecoveryStorage,
  now = Date.now(),
) {
  if (!isRecoverableClientBundleError(error)) return false;

  const lastAttempt = Number(storage.getItem(CLIENT_BUNDLE_RECOVERY_KEY));
  if (Number.isFinite(lastAttempt) && lastAttempt > 0 && now - lastAttempt < CLIENT_BUNDLE_RECOVERY_WINDOW_MS) {
    return false;
  }

  storage.setItem(CLIENT_BUNDLE_RECOVERY_KEY, String(now));
  return true;
}
