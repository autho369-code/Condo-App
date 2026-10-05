// Platform operators come in three roles: admin, support, readonly. Database
// guards stop non-admin operators writing through RLS and SECURITY DEFINER
// RPCs, but server actions and route handlers often switch to the
// service-role client, where the database no longer knows who started the
// write. Middleware therefore refuses every non-GET request from a non-admin
// operator, except the few a person needs just to use their own session.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Writes any operator may make about their own session. */
const SELF_SERVICE_PATHS = ['/mfa', '/api/auth/mfa-complete', '/account'];

/** Support operators also work the support-request queue. */
const SUPPORT_PATHS = ['/platform-operator/support'];

function pathMatches(pathname: string, paths: readonly string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export type OperatorIdentity = {
  is_platform_operator?: boolean | null;
  platform_operator_role?: string | null;
} | null | undefined;

/** True when this request must be refused: a write by a non-admin operator. */
export function blocksOperatorWrite(identity: OperatorIdentity, method: string, pathname: string): boolean {
  if (!identity?.is_platform_operator) return false;
  if (identity.platform_operator_role === 'admin') return false;
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  if (pathMatches(pathname, SELF_SERVICE_PATHS)) return false;
  if (identity.platform_operator_role === 'support' && pathMatches(pathname, SUPPORT_PATHS)) return false;
  return true;
}
