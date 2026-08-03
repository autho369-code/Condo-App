const LOGIN_ERRORS: Record<string, string> = {
  workspace_not_found: 'We could not find this company workspace. Check the web address or contact Portier369 support.',
  workspace_access_denied: 'This account does not have access to this company workspace. Use the sign-in link provided by your management company.',
  platform_workspace_only: 'Platform operators sign in at portier369.com. Company workspaces are reserved for company administrators, managers, owners, board members, and vendors.',
  session_expired: 'Your session expired. Sign in again to continue.',
};

export function loginErrorMessage(value: string | null | undefined) {
  if (!value) return null;
  return LOGIN_ERRORS[value] ?? value;
}
