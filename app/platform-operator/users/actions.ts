'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requirePlatformOperator } from '@/lib/auth/me';
import { isProfileRole } from '@/lib/auth/profile-roles';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resetUserMfa as resetMfaFactors } from '@/lib/auth/mfa-admin';

const USERS = '/platform-operator/users';

function fail(message: string): never {
  redirect(`${USERS}?error=${encodeURIComponent(message)}`);
}

async function requireUserAdministrator() {
  const me = await requirePlatformOperator();
  const svc = createServiceClient() as any;
  const { data: operator, error } = await svc
    .from('platform_operators')
    .select('role, active')
    .eq('auth_user_id', me.auth_user_id)
    .maybeSingle();

  if (error || !operator?.active || operator.role !== 'admin') {
    fail('Platform administrator access is required to manage users.');
  }

  return { me, svc };
}

async function loadManagedTarget(svc: any, userId: string) {
  const [{ data: profile, error: profileError }, { data: operator, error: operatorError }, authResult] = await Promise.all([
    svc.from('profiles').select('id, email, hoa_role, disabled_at, portfolio_id').eq('id', userId).maybeSingle(),
    svc.from('platform_operators').select('id').eq('auth_user_id', userId).maybeSingle(),
    svc.auth.admin.getUserById(userId),
  ]);

  if (profileError || !profile) fail(`User profile not found${profileError ? `: ${profileError.message}` : '.'}`);
  if (operatorError) fail(`Could not verify the target account: ${operatorError.message}`);
  if (operator) fail('Platform operator accounts must be managed from the Platform Operators area.');
  if (authResult.error || !authResult.data?.user) {
    fail(`Authentication account not found${authResult.error ? `: ${authResult.error.message}` : '.'}`);
  }

  return { profile, authUser: authResult.data.user };
}

function restoreBanDuration(bannedUntil: string | null | undefined): string {
  const remainingMs = bannedUntil ? Date.parse(bannedUntil) - Date.now() : 0;
  return remainingMs > 0 ? `${Math.max(1, Math.ceil(remainingMs / 3_600_000))}h` : 'none';
}

async function rollbackLogin(
  svc: any,
  userId: string,
  previousDisabledAt: string | null,
  previousBannedUntil: string | null | undefined,
) {
  const [profileRollback, authRollback] = await Promise.all([
    svc.from('profiles').update({ disabled_at: previousDisabledAt }).eq('id', userId).select('id').single(),
    svc.auth.admin.updateUserById(userId, { ban_duration: restoreBanDuration(previousBannedUntil) }),
  ]);
  return profileRollback.error?.message ?? authRollback.error?.message ?? null;
}

export async function toggleUserDisable(formData: FormData) {
  const { me, svc } = await requireUserAdministrator();
  const userId = formData.get('user_id') as string;
  const action = formData.get('action') as string;

  if (!userId || !['disable', 'enable'].includes(action)) fail('Invalid user status request.');
  if (userId === me.auth_user_id) fail('You cannot change the status of your own platform account here.');

  const { profile, authUser } = await loadManagedTarget(svc, userId);
  const disabling = action === 'disable';
  if (disabling && profile.disabled_at) fail('This user is already disabled.');
  if (!disabling && !profile.disabled_at) fail('This user is already enabled.');

  const disabledAt = disabling ? new Date().toISOString() : null;
  const { error: authError } = await svc.auth.admin.updateUserById(userId, {
    ban_duration: disabling ? '876000h' : 'none',
  });
  if (authError) fail(`Could not ${action} the login: ${authError.message}`);

  let profileUpdate = svc.from('profiles').update({ disabled_at: disabledAt }).eq('id', userId);
  profileUpdate = disabling
    ? profileUpdate.is('disabled_at', null)
    : profileUpdate.not('disabled_at', 'is', null);
  const { data: updatedProfile, error: profileError } = await profileUpdate.select('id').single();
  if (profileError || !updatedProfile) {
    const { error: rollbackError } = await svc.auth.admin.updateUserById(userId, {
      ban_duration: restoreBanDuration(authUser.banned_until),
    });
    fail(rollbackError
      ? `Profile update and login rollback both failed. Contact engineering: ${profileError?.message ?? 'profile state changed'}`
      : `Could not ${action} the user profile: ${profileError?.message ?? 'profile state changed'}`);
  }

  const { error: auditError } = await svc.from('audit_logs').insert({
    entity_type: 'user',
    entity_id: userId,
    action: disabling ? 'user_disabled' : 'user_enabled',
    actor_id: me.auth_user_id,
    actor_email: me.email,
    changes: {
      email: profile.email,
      previous_disabled_at: profile.disabled_at,
      disabled_at: disabledAt,
    },
  });
  if (auditError) {
    const rollbackError = await rollbackLogin(svc, userId, profile.disabled_at, authUser.banned_until);
    fail(rollbackError
      ? `Audit and rollback both failed. Contact engineering: ${auditError.message}`
      : `The status change was rolled back because the audit log failed: ${auditError.message}`);
  }

  revalidatePath(USERS);
  redirect(`${USERS}?${disabling ? 'disabled' : 'enabled'}=1`);
}

export async function changeUserRole(formData: FormData) {
  const { me } = await requireUserAdministrator();
  const userId = formData.get('user_id') as string;
  const newRole = formData.get('hoa_role') as string;

  if (!userId) fail('Missing user id.');
  if (!isProfileRole(newRole)) fail('Select a supported Portier369 profile role.');
  if (userId === me.auth_user_id) fail('You cannot change your own platform profile role here.');

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('platform_set_profile_role', {
    p_profile_id: userId,
    p_hoa_role: newRole,
  });
  if (error) fail(`Could not change the user's role: ${error.message}`);

  revalidatePath(USERS);
  redirect(`${USERS}?role_changed=1`);
}

export async function resetUserMfa(formData: FormData) {
  const { me, svc } = await requireUserAdministrator();
  const userId = String(formData.get('user_id') ?? '');
  if (!userId) fail('Missing user id.');
  if (userId === me.auth_user_id) fail('You cannot reset your own platform MFA. Ask another platform administrator.');

  const { profile } = await loadManagedTarget(svc, userId);
  const reset = await resetMfaFactors({
    service: svc,
    userId,
    targetEmail: profile.email,
    actorId: me.auth_user_id!,
    actorEmail: me.email,
    portfolioId: profile.portfolio_id ?? null,
  });
  if (reset.error) fail(reset.error);

  revalidatePath(USERS);
  redirect(`${USERS}?mfa_reset=1`);
}
