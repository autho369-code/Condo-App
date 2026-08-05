const LOGIN_ERRORS: Record<string, string> = {
  workspace_not_found: 'We could not find this company workspace. Check the web address or contact Portier369 support.',
  workspace_access_denied: 'This account does not have access to this company workspace. Use the sign-in link provided by your management company.',
  platform_workspace_only: 'Platform operators sign in at portier369.com. Company workspaces are reserved for company administrators, managers, owners, board members, and vendors.',
  session_expired: 'Your session expired. Sign in again to continue.',
  invalid_credentials: 'The email or password is incorrect. Try again or reset your password.',
  sign_in_failed: 'We could not sign you in. Try again, or contact your management company if the problem continues.',
  too_many_attempts: 'Too many sign-in attempts. Wait 15 minutes before trying again, or reset your password.',
  login_temporarily_unavailable: 'Secure sign-in is temporarily unavailable. Please try again in a minute.',
};

export function loginErrorMessage(value: string | null | undefined) {
  if (!value) return null;
  return LOGIN_ERRORS[value] ?? value;
}
