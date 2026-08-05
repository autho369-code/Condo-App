'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requirePlatformOperator } from '@/lib/auth/me';
import { resetUserMfa } from '@/lib/auth/mfa-admin';
import { createServiceClient } from '@/lib/supabase/server';

const OPERATORS = '/platform-operator/operators';

function fail(message: string): never {
  redirect(`${OPERATORS}?error=${encodeURIComponent(message)}`);
}

export async function resetOperatorMfa(formData: FormData) {
  const me = await requirePlatformOperator();
  const targetUserId = String(formData.get('user_id') ?? '');
  if (!targetUserId) fail('Missing operator account.');
  if (targetUserId === me.auth_user_id) fail('You cannot reset your own MFA. Ask another platform administrator or use the documented support recovery process.');

  const service = createServiceClient() as any;
  const [{ data: actor, error: actorError }, { data: target, error: targetError }] = await Promise.all([
    service.from('platform_operators').select('role, active').eq('auth_user_id', me.auth_user_id).maybeSingle(),
    service.from('platform_operators').select('auth_user_id, email').eq('auth_user_id', targetUserId).maybeSingle(),
  ]);
  if (actorError || !actor?.active || actor.role !== 'admin') fail('Platform administrator access is required to reset operator MFA.');
  if (targetError || !target) fail('Platform operator not found.');

  const reset = await resetUserMfa({
    service,
    userId: target.auth_user_id,
    targetEmail: target.email,
    actorId: me.auth_user_id!,
    actorEmail: me.email,
  });
  if (reset.error) fail(reset.error);

  revalidatePath(OPERATORS);
  redirect(`${OPERATORS}?mfa_reset=1`);
}
