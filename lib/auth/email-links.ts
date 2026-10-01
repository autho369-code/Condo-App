// Links emailed from auth.admin.generateLink().
//
// generateLink's action_link goes through Supabase's /verify endpoint, which
// (for admin-generated, non-PKCE tokens) returns the session in the URL
// fragment (#access_token=…). Our callback only exchanges ?code=, so reset
// and verification links ended at /login?error=auth_callback_failed and
// password resets were impossible. Instead we email a link to our own
// /confirm page carrying the token hash; the user presses Continue and the
// server verifies it with verifyOtp(), which sets the session cookies.
// (A confirm button rather than verify-on-GET keeps email link scanners
// from using up the one-time token.)

export const CONFIRMABLE_OTP_TYPES = ['recovery', 'signup', 'invite', 'magiclink', 'email', 'email_change'] as const;
export type ConfirmableOtpType = (typeof CONFIRMABLE_OTP_TYPES)[number];

/**
 * Build the emailed link from generateLink() output. `redirectTo` is the same
 * URL passed to generateLink (…/api/auth/callback?next=/reset-password): its
 * origin keeps the tenant's workspace host and its `next` is carried over.
 * Falls back to the provider link only if no hashed token was returned.
 */
export function verifiedAuthLink(
  linkData: { properties?: { action_link?: string; hashed_token?: string; verification_type?: string } } | null | undefined,
  redirectTo: string,
  fallbackType: ConfirmableOtpType,
): string {
  const props = linkData?.properties ?? {};
  if (!props.hashed_token) return props.action_link ?? '';
  const target = new URL(redirectTo);
  const type = (CONFIRMABLE_OTP_TYPES as readonly string[]).includes(props.verification_type ?? '')
    ? (props.verification_type as ConfirmableOtpType)
    : fallbackType;
  const params = new URLSearchParams({ token_hash: props.hashed_token, type });
  const next = target.searchParams.get('next');
  if (next) params.set('next', next);
  return `${target.origin}/confirm?${params.toString()}`;
}
