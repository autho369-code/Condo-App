const LOGIN_ERRORS: Record<string, string> = {
  workspace_not_found: 'We could not find this company workspace. Check the web address or contact Portier369 support.',
  workspace_access_denied: 'This account does not have access to this company workspace. Use the sign-in link provided by your management company.',
  platform_workspace_only: 'Platform operators sign in at portier369.com. Company workspaces are reserved for company administrators, managers, owners, board members, and vendors.',
  session_expired: 'Your session expired. Sign in again to continue.',
  invalid_credentials: 'The email or password is incorrect. Try again or reset your password.',
  sign_in_failed: 'We could not sign you in. Try again, or contact your management company if the problem continues.',
  too_many_attempts: 'Too many sign-in attempts. Wait 15 minutes before trying again, or reset your password.',
  login_temporarily_unavailable: 'Secure sign-in is temporarily unavailable. Please try again in a minute.',
  reset_link_expired: 'That password reset link has expired or was already used. Request a new one below.',
  link_expired: 'That link has expired or was already used. Request a new one, or contact your management company.',
  link_invalid: 'That link is incomplete. Use the most recent email and try again.',
  auth_callback_failed: 'We could not complete sign-in from that link. Request a new email and try again.',
  account_disabled: 'This account is disabled. Contact your management company for access.',
  portal_access_disabled: 'Portal access for this account is turned off. Contact your management company.',
  company_suspended: 'This company workspace is suspended. Contact your management company.',
};

const GENERIC_ERROR = 'We could not sign you in. Try again, or contact your management company if the problem continues.';

export function loginErrorMessage(value: string | null | undefined) {
  if (!value) return null;
  // Never echo unknown ?error= text: it would let a crafted link put any
  // message on the real sign-in page.
  return LOGIN_ERRORS[value] ?? GENERIC_ERROR;
}

// Informational notices for /login?notice=… (allowlisted, never raw text).
const LOGIN_NOTICES: Record<string, string> = {
  verify_email: 'Check your email to verify and activate your account, then sign in.',
  password_updated: 'Your password was updated. Sign in with your new password.',
};

export function loginNoticeMessage(value: string | null | undefined) {
  return value ? LOGIN_NOTICES[value] ?? null : null;
}
