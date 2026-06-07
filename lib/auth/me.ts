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

function localPreviewEnabled() {
  return process.env.LOCAL_PREVIEW_MODE === 'true';
}

function localPreviewMe(): MeResult {
  return {
    auth_user_id: 'local-preview',
    email: 'preview@manageops.local',
    profile: { full_name: 'Local Preview' },
    portfolio: { id: 'local-preview', name: 'ManageOps Preview', company_name: 'ManageOps Preview' },
    role_name: 'Platform Operator',
    is_platform_operator: true,
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
  if (!me.is_full_access_staff && !me.is_platform_operator) redirect('/dashboard');
  return me;
}

export async function requireStaff(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_staff && !me.is_platform_operator) redirect('/portal');
  return me;
}

export async function requireBoard(): Promise<MeResult> {
  const me = await requireAuth();
  if (!me.is_board && !me.is_platform_operator) redirect('/portal');
  return me;
}
