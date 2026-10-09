// Wraps the me() RPC. Single server call, returns everything the UI needs to
// decide what to show in the sidebar and which pages to allow.
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isActivePortalRecord, isActiveProfile } from '@/lib/security/portal-access';
import { tenantAccessDecision } from '@/lib/tenant/host';
import { tenantFromHeaders } from '@/lib/tenant/resolve';
import { requiresMfa } from '@/lib/auth/mfa-policy';
import { safeInternalNext } from '@/lib/security/redirects';
import { cache } from 'react';
import { predominantTimeZone, setDisplayTimeZone } from '@/lib/time/display-zone';

export interface MeResult {
  auth_user_id: string | null;
  email: string | null;
  profile: any;
  portfolio: any;
  role_name: string | null;
  is_platform_operator: boolean;
  /** 'admin' | 'support' | 'readonly' for platform operators, else null. */
  platform_operator_role?: string | null;
  is_company_admin: boolean;
  is_full_access_staff: boolean;
  is_finance_staff: boolean;
  is_staff: boolean;
  is_board: boolean;
  is_resident: boolean;
  is_tenant: boolean;
  owner_id: string | null;
  tenant_id: string | null;
  vendor_id: string | null;
  /** Every vendor record of this login (one per association it was invited to); vendor_id is the first. */
  vendor_ids: string[];
  board_association_ids: string[];
  resident_association_ids: string[];
  resident_unit_ids: string[];
  tenant_association_ids: string[];
  tenant_unit_ids: string[];
}

// Fail LOUDLY (at module load, i.e. build/boot) if someone sets the local
// preview flag on a production deployment — it fabricates a super-admin
// identity and must never be silently ignored there.
if (process.env.LOCAL_PREVIEW_MODE === 'true' && process.env.NODE_ENV === 'production') {
  throw new Error(
    'LOCAL_PREVIEW_MODE=true is set in a production build. Remove it from the environment — preview mode fabricates a platform-operator identity.',
  );
}

function localPreviewEnabled() {
  // Never honor preview mode in production — it fabricates a super-admin
  // identity and must not be reachable on a deployed instance.
  return process.env.LOCAL_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production';
}

function localPreviewMe(): MeResult {
  return {
    auth_user_id: 'local-preview',
    email: 'preview@manageops.local',
    profile: { full_name: 'Local Preview' },
    portfolio: { id: 'local-preview', name: 'ManageOps Preview', company_name: 'ManageOps Preview' },
    role_name: 'Platform Operator',
    is_platform_operator: true,
    is_company_admin: true,
    is_full_access_staff: true,
    is_finance_staff: true,
    is_staff: true,
    is_board: false,
    is_resident: false,
    is_tenant: false,
    owner_id: null,
    tenant_id: null,
    vendor_id: null,
    vendor_ids: [],
    board_association_ids: [],
    resident_association_ids: [],
    resident_unit_ids: [],
    tenant_association_ids: [],
    tenant_unit_ids: [],
  };
}

function decodeRequestPath(value: string | null): string | null {
  if (!value) return null;
  try {
    return safeInternalNext(decodeURIComponent(value));
  } catch {
    return null;
  }
}

// One me() per request. The layout and the page (and any helper) each call a
// guard; uncached, every page load ran me() several times, each a round trip
// to the database. React's cache() is scoped to a single request.
const loadMe = cache(async () => {
  const supabase = await createClient();
  return (supabase as any).rpc('me') as Promise<{ data: unknown; error: any }>;
});

// The MFA level read once per request, for the same reason.
const loadAssuranceLevel = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.mfa.getAuthenticatorAssuranceLevel();
});

async function enforceConfiguredMfa(me: MeResult, _supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!me.auth_user_id || !requiresMfa(me) || localPreviewEnabled()) return;

  const { data, error } = await loadAssuranceLevel();
  if (!error && data?.currentLevel === 'aal2') return;

  const requestPath = decodeRequestPath((await headers()).get('x-portier-request-path'));
  const requestPathname = requestPath
    ? new URL(requestPath, 'https://portier369.invalid').pathname
    : null;
  const home = roleHome(me);
  const safeHome = home === '/login' ? '/account' : home;
  const candidate = requestPath && requestPathname !== '/mfa' && !requestPathname?.startsWith('/api/')
    ? requestPath
    : safeHome;
  const candidatePathname = new URL(candidate, 'https://portier369.invalid').pathname;
  const next = candidatePathname === '/login' || candidatePathname === '/mfa'
    ? safeHome
    : candidate;
  const query = new URLSearchParams({ next });
  if (error) query.set('error', 'verification_unavailable');
  redirect(`/mfa?${query.toString()}`);
}

// Format timestamps in the viewer's association zone for the rest of this
// request (RLS limits the read to associations they can see). Once per request.
const primeDisplayTimeZone = cache(async (): Promise<void> => {
  try {
    const supabase = await createClient();
    const { data } = await (supabase as any).from('associations').select('timezone').limit(1000);
    setDisplayTimeZone(predominantTimeZone(((data ?? []) as Array<{ timezone: string | null }>).map((a) => a.timezone)));
  } catch {
    // Keep the default zone.
  }
});

/** Every operator role: for genuine own-account/session self-service only. */
export const ALL_OPERATOR_ROLES = ['admin', 'support', 'readonly'] as const;

export async function getMe(options: {
  enforceMfa?: boolean;
  /**
   * Operator roles allowed to proceed inside a server action. Defaults to
   * admins only, so any action reaching a privileged write through getMe()
   * refuses support/readonly operators however it was routed. Only
   * self-service entry points (requireAuth, sign-in) widen it.
   */
  operatorActionRoles?: readonly string[];
} = {}): Promise<MeResult> {
  const supabase = await createClient();
  const { data, error } = await loadMe();
  if (error) {
    if (localPreviewEnabled()) return localPreviewMe();
    throw error;
  }
  const me = data as MeResult;
  if (me && !Array.isArray(me.vendor_ids)) me.vendor_ids = me.vendor_id ? [me.vendor_id] : [];
  if (me?.auth_user_id && !isActiveProfile(me.profile)) {
    await supabase.auth.signOut();
    redirect('/login?error=account_disabled');
  }
  // A suspended company's members lose data access in RLS (me().portfolio
  // comes back empty); sign them out with an explanation instead of showing
  // empty pages.
  const profilePortfolioId = (me?.profile as any)?.portfolio_id as string | undefined;
  if (me?.auth_user_id && !me.is_platform_operator && profilePortfolioId && !me.portfolio) {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const { data: pf } = await (createServiceClient() as any).from('portfolios').select('suspended_at').eq('id', profilePortfolioId).maybeSingle();
    if (pf?.suspended_at) {
      await supabase.auth.signOut();
      redirect('/login?error=company_suspended');
    }
  }
  if (!me?.auth_user_id && localPreviewEnabled()) return localPreviewMe();
  if (options.enforceMfa !== false) await enforceConfiguredMfa(me, supabase);
  if (me?.auth_user_id) await primeDisplayTimeZone();
  if (me?.auth_user_id) await refuseOperatorAction(me, options.operatorActionRoles ?? ['admin']);
  return me;
}

/** Guard helpers — throw redirect if user doesn't have access. */
export async function requireAuth(options: { operatorActionRoles?: readonly string[] } = {}): Promise<MeResult> {
  // Inside a server action only operator admins proceed by default, so every
  // guard built on requireAuth (owner, tenant, board, staff, ...) inherits the
  // refusal. Genuine self-service (the account page) opts in explicitly.
  const me = await getMe({ operatorActionRoles: options.operatorActionRoles ?? ['admin'] });
  if (!me.auth_user_id) redirect('/login');
  await requireMatchingTenantWorkspace(me);
  return me;
}

/**
 * Enforce the request hostname as an authorization boundary in server code.
 * Middleware performs the same check for early rejection, but layouts and
 * route handlers must not rely on middleware as their only protection.
 */
export async function requireMatchingTenantWorkspace(me: MeResult) {
  const tenant = tenantFromHeaders(await headers());
  if (!tenant) return null;

  const decision = tenantAccessDecision(tenant.portfolioId, me);
  if (!decision.allowed) {
    redirect(`/login?error=${decision.reason === 'platform_operator_on_tenant'
      ? 'platform_workspace_only'
      : 'workspace_access_denied'}`);
  }
  return tenant;
}

/**
 * Only operator admins change data. Server actions often write through the
 * service-role client, where the database cannot see the initiating operator,
 * and an action ID can be posted to any path (so middleware's path checks
 * cannot be the only gate). Inside a server action, refuse operators whose
 * role is not in `allowed`.
 */
// Applies whatever other roles the account holds: the database guards also
// refuse non-admin operators outright, and a dual-role account must not
// regain service-role writes by rebinding an action to another path.
async function refuseOperatorAction(me: MeResult, allowed: readonly string[] = ['admin']) {
  if (!me.is_platform_operator) return;
  if (allowed.includes(me.platform_operator_role ?? '')) return;
  if (!(await isMutationRequest())) return;
  redirect('/platform-operator?error=' + encodeURIComponent('Only Portier platform admins can make changes.'));
}

/**
 * A server action or any other non-GET request. Next also runs actions from
 * plain multipart POSTs without the Next-Action header, so the method stamped
 * by middleware (client-supplied values are stripped there) is checked too.
 */
async function isMutationRequest(): Promise<boolean> {
  const h = await headers();
  if (h.get('next-action')) return true;
  // Middleware stamps the method on every request it matches; a request it
  // skipped (e.g. a path ending in .png routed to a catch-all page) has no
  // trusted method and is treated as a possible mutation (fail closed).
  const method = h.get('x-portier-request-method');
  return !method || !['GET', 'HEAD', 'OPTIONS'].includes(method);
}


export async function requirePlatformOperator(): Promise<MeResult> {
  const me = await requireAuth({ operatorActionRoles: ['admin', 'support'] });
  if (!me.is_platform_operator) redirect('/dashboard');
  // Support operators work the support queue; its actions and every other
  // operator write re-check the admin role themselves.
  await refuseOperatorAction(me, ['admin', 'support']);
  return me;
}

/**
 * Platform operators come in admin / support / readonly roles, but
 * is_platform_operator() only checks `active`. Mutations (creating companies,
 * invitations, ownership transfer, suspension, billing) need role = 'admin'.
 */
export async function requirePlatformAdmin(): Promise<MeResult> {
  const me = await requirePlatformOperator();
  const { createServiceClient } = await import('@/lib/supabase/server');
  const { data: operator } = await (createServiceClient() as any)
    .from('platform_operators')
    .select('role, active')
    .eq('auth_user_id', me.auth_user_id)
    .maybeSingle();
  if (!operator?.active || operator.role !== 'admin') {
    redirect('/platform-operator?error=' + encodeURIComponent('Platform administrator access is required for this action.'));
  }
  return me;
}

export function hasPortfolioAdminAccess(
  me: Pick<MeResult, 'is_company_admin' | 'is_platform_operator'>,
): boolean {
  return me.is_company_admin || me.is_platform_operator;
}

export async function requirePortfolioAdmin(): Promise<MeResult> {
  const me = await requireAuth();
  if (!hasPortfolioAdminAccess(me)) redirect('/dashboard');
  await refuseOperatorAction(me);
  return me;
}

/** Where a user's "home" surface is, by role precedence. */
export function roleHome(me: MeResult): string {
  if (me.is_platform_operator) return '/platform-operator';
  if (me.is_company_admin) return '/company-admin/overview';
  if (me.is_staff) return '/dashboard';
  if (me.is_board) return '/board';
  if (me.vendor_id) return '/vendor';
  if (me.owner_id) return '/portal';
  if (me.is_tenant && me.tenant_id) return '/resident';
  return '/login';
}

export async function requireStaff(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_staff && !me.is_platform_operator) redirect(roleHome(me));
  await refuseOperatorAction(me);
  return me;
}

export async function requireBoard(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_board && !me.is_platform_operator) redirect(roleHome(me));
  await refuseOperatorAction(me);
  return me;
}

export async function requireVendor() {
  const me = await getMe();
  if (!me.auth_user_id) redirect('/login?mode=vendor');
  await requireMatchingTenantWorkspace(me);
  if (!me.vendor_id || !me.vendor_ids?.length) redirect('/login?mode=vendor');

  // Vendor access is tenant-local just like owner access. Never disable the
  // shared Auth identity because it may also hold staff/board/owner roles.
  const supabase = await createClient();
  const { data: vendor, error } = await (supabase as any)
    .from('vendors')
    .select('id, portal_activated, archived_at')
    .eq('id', me.vendor_id)
    .maybeSingle();
  if (error || !isActivePortalRecord(vendor)) {
    redirect('/login?mode=vendor&error=portal_access_disabled');
  }
  return me;
}

/** Shared staff workspace, including company admins who may not hold a staff role row. */
export async function requireWorkspaceStaff(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_staff && !me.is_company_admin && !me.is_platform_operator) redirect(roleHome(me));
  await refuseOperatorAction(me);
  return me;
}

/** Financial administration for accountants, full-access staff, company admins, and operators. */
export async function requireFinanceOrPortfolioAdmin(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_finance_staff && !me.is_company_admin && !me.is_platform_operator) redirect(roleHome(me));
  await refuseOperatorAction(me);
  return me;
}

export async function requireFinanceStaff(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_finance_staff && !me.is_platform_operator) redirect(roleHome(me));
  await refuseOperatorAction(me);
  return me;
}

export async function requireOwner(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.owner_id) redirect('/login?mode=owner');

  // Owner access is tenant-local. Do not use an Auth ban here: one identity can
  // also hold board/vendor/staff access that must remain intact. Fail closed if
  // the RLS-scoped owner row cannot be read or is not explicitly activated.
  const supabase = await createClient();
  const { data: owner, error } = await (supabase as any)
    .from('owners')
    .select('id, portal_activated, archived_at')
    .eq('id', me.owner_id)
    .maybeSingle();
  if (error || !isActivePortalRecord(owner)) {
    redirect('/login?mode=owner&error=portal_access_disabled');
  }
  return me;
}

/** Guard the non-owner resident portal without granting owner financial access. */
export async function requireTenant(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_tenant || !me.tenant_id) redirect('/login?mode=resident');

  const supabase = await createClient();
  const { data: tenant, error } = await (supabase as any)
    .from('tenants')
    .select('id, status, portal_activated, archived_at')
    .eq('id', me.tenant_id)
    .maybeSingle();
  if (
    error
    || !isActivePortalRecord(tenant)
    || tenant?.status !== 'active'
  ) {
    redirect('/login?mode=resident&error=portal_access_disabled');
  }
  return me;
}

