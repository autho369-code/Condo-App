type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
};

const STALE_SESSION_CODES = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
]);

export function isSupabaseAuthCookie(name: string) {
  return name.startsWith('sb-') && name.includes('-auth-token');
}

export function isStaleAuthSession(error: AuthErrorLike | null | undefined) {
  if (!error) return false;

  const code = typeof error.code === 'string' ? error.code.toLowerCase() : '';
  if (STALE_SESSION_CODES.has(code)) return true;

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('refresh token not found')
    || message.includes('invalid refresh token')
    || message.includes('refresh token already used');
}
