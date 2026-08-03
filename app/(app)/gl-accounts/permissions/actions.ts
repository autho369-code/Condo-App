'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function setGlRolePermission(formData: FormData) {
  await requirePortfolioAdmin();
  const accountId = String(formData.get('gl_account_id') ?? '');
  const roleId = String(formData.get('role_id') ?? '');
  const permission = String(formData.get('permission') ?? 'none');
  if (!UUID.test(accountId) || !UUID.test(roleId) || !['none', 'read', 'full'].includes(permission)) {
    redirect('/gl-accounts/permissions?error=' + encodeURIComponent('Invalid GL permission request.'));
  }
  const { error } = await (await createClient() as any).rpc('set_gl_role_permission', {
    p_gl_account_id: accountId,
    p_role_id: roleId,
    p_permission: permission,
  });
  if (error) redirect(`/gl-accounts/permissions?role_id=${roleId}&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/gl-accounts');
  revalidatePath('/gl-accounts/permissions');
  redirect(`/gl-accounts/permissions?role_id=${roleId}&saved=1`);
}
