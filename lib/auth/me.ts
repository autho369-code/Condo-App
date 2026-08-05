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

export interface MeResult {
  auth_user_id: string | null;
  email: string | null;
  profile: any;
  portfolio: any;
  role_name: string | null;
  is_platform_operator: boolean;
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
  board_association_ids: string[];
  resident_association_ids: string[];
  resident_unit_ids: string[];
  tenant_association_ids: string[];
  tenant_unit_ids: string[];
}

// Fail LOUDLY (at module load, i.e. build/boot) if someone sets the local
// preview flag on a production deployment â€” it fabricates a super-admin
// identity and must never be silently ignored there.
if (process.env.LOCAL_PREVIEW_MODE === 'true' && process.env.NODE_ENV === 'production') {
  throw new Error(
    'LOCAL_PREVIEW_MODE=true is set in a production build. Remove it from the environment â€” preview mode fabricates a platform-operator identity.',
  );
}

function localPreviewEnabled() {
  // Never honor preview mode in production â€” it fabricates a super-admin
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

async function enforceConfiguredMfa(me: MeResult, supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!me.auth_user_id || !requiresMfa(me) || localPreviewEnabled()) return;

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
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

export async function getMe(options: { enforceMfa?: boolean } = {}): Promise<MeResult> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('me');
  if (error) {
    if (localPreviewEnabled()) return localPreviewMe();
    throw error;
  }
  const me = data as MeResult;
  if (me?.auth_user_id && !isActiveProfile(me.profile)) {
    await supabase.auth.signOut();
    redirect('/login?error=account_disabled');
  }
  if (!me?.auth_user_id && localPreviewEnabled()) return localPreviewMe();
  if (options.enforceMfa !== false) await enforceConfiguredMfa(me, supabase);
  return me;
}

/** Guard helpers â€” throw redirect if user doesn't have access. */
export async function requireAuth(): Promise<MeResult> {
  const me = await getMe();
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

export async function requirePlatformOperator(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_platform_operator) redirect('/dashboard');
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
  return me;
}

export async function requireBoard(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_board && !me.is_platform_operator) redirect(roleHome(me));
  return me;
}

export async function requireVendor() {
  const me = await getMe();
  if (!me.auth_user_id) redirect('/login?mode=vendor');
  await requireMatchingTenantWorkspace(me);
  if (!me.vendor_id) redirect('/login?mode=vendor');

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
  return me;
}

/** Financial administration for accountants, full-access staff, company admins, and operators. */
export async function requireFinanceOrPortfolioAdmin(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_finance_staff && !me.is_company_admin && !me.is_platform_operator) redirect(roleHome(me));
  return me;
}

export async function requireFinanceStaff(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_finance_staff && !me.is_platform_operator) redirect(roleHome(me));
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

