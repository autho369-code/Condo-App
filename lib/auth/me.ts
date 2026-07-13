// Wraps the me() RPC. Single server call, returns everything the UI needs to
// decide what to show in the sidebar and which pages to allow.
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

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
  owner_id: string | null;
  vendor_id: string | null;
  board_association_ids: string[];
  resident_association_ids: string[];
  resident_unit_ids: string[];
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
    owner_id: null,
    vendor_id: null,
    board_association_ids: [],
    resident_association_ids: [],
    resident_unit_ids: [],
  };
}

export async function getMe(): Promise<MeResult> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('me');
  if (error) {
    if (localPreviewEnabled()) return localPreviewMe();
    throw error;
  }
  const me = data as MeResult;
  if (!me?.auth_user_id && localPreviewEnabled()) return localPreviewMe();
  return me;
}

/** Guard helpers — throw redirect if user doesn't have access. */
export async function requireAuth(): Promise<MeResult> {
  const me = await getMe();
  if (!me.auth_user_id) redirect('/login');
  return me;
}

export async function requirePlatformOperator(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_platform_operator) redirect('/dashboard');
  return me;
}

export async function requirePortfolioAdmin(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_full_access_staff && !me.is_company_admin && !me.is_platform_operator) redirect('/dashboard');
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
  if (!me.vendor_id) redirect('/login?mode=vendor');
  return me;
}

export async function requireOwner(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.owner_id) redirect('/login?mode=owner');
  return me;
}
