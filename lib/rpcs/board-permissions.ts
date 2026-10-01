'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import {
  BOARD_PERMISSIONS,
  BOARD_ROLES,
  RECOMMENDED_PERMISSIONS,
} from '@/lib/board/permission-catalog';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Save an association's officer permission matrix. A checked box means the
 * role holds the permission. The "recommended" preset applies
 * RECOMMENDED_PERMISSIONS instead of the submitted boxes.
 * Authorization is re-checked in set_board_role_permissions (can_manage_association).
 */
export async function saveOfficerPermissions(formData: FormData) {
  await requireStaff();
  const associationId = String(formData.get('association_id') ?? '');
  if (!UUID.test(associationId)) redirect('/associations');
  const back = `/associations/${associationId}/board`;
  const preset = formData.get('preset') === 'recommended';

  const entries = BOARD_PERMISSIONS.flatMap((permission) =>
    BOARD_ROLES.map((role) => ({
      role,
      permission,
      allowed: preset
        ? RECOMMENDED_PERMISSIONS[permission].includes(role)
        : formData.get(`perm:${permission}:${role}`) === 'on',
    })),
  );

  const db = (await createClient()) as any;
  const { error } = await db.rpc('set_board_role_permissions', {
    p_association_id: associationId,
    p_permissions: entries,
  });
  if (error) redirect(`${back}?perm_error=${encodeURIComponent(error.message)}#officer-permissions`);
  revalidatePath(back);
  redirect(`${back}?perm_saved=${preset ? 'recommended' : '1'}#officer-permissions`);
}
