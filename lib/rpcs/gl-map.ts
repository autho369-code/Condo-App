'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { GL_MAP_KEYS } from '@/lib/gl/accounts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Set one default in the GL account map. set_gl_account_map re-checks finance
// access, that the account is an active company-wide account of the caller's
// company, and that its type fits the default.
export async function setGlAccountMap(formData: FormData) {
  await requireFinanceStaff();
  const key = String(formData.get('map_key') ?? '');
  const accountId = String(formData.get('gl_account_id') ?? '');
  const fail = (m: string): never => redirect('/gl-accounts/map?error=' + encodeURIComponent(m));
  if (!GL_MAP_KEYS.some((k) => k.key === key)) fail('Unknown default.');
  if (!UUID.test(accountId)) fail('Choose an account.');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('set_gl_account_map', { p_key: key, p_gl_account_id: accountId });
  if (error) fail(error.message);
  revalidatePath('/gl-accounts/map');
  redirect('/gl-accounts/map?saved=1');
}
