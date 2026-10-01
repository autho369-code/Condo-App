'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}
function uuid(formData: FormData, key: string) {
  const v = text(formData, key);
  return UUID.test(v) ? v : null;
}

/** Add or update a project cost category. Scope is re-checked in save_project_budget_line. */
export async function saveProjectBudgetLine(formData: FormData) {
  await requireFinanceStaff();
  const projectId = uuid(formData, 'project_id');
  const back = `/projects/${projectId ?? ''}`;
  const amount = Number(text(formData, 'budget_amount').replace(/[$,\s]/g, ''));
  const db = (await createClient()) as any;
  const { error } = await db.rpc('save_project_budget_line', {
    p_project_id: projectId,
    p_id: uuid(formData, 'line_id'),
    p_category: text(formData, 'category'),
    p_gl_account_id: uuid(formData, 'gl_account_id'),
    p_budget_amount: Number.isFinite(amount) ? amount : null,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
  redirect(`${back}?saved=${encodeURIComponent('Cost category saved.')}`);
}

export async function deleteProjectBudgetLine(formData: FormData) {
  await requireFinanceStaff();
  const back = `/projects/${uuid(formData, 'project_id') ?? ''}`;
  const db = (await createClient()) as any;
  const { error } = await db.rpc('delete_project_budget_line', { p_id: uuid(formData, 'line_id') });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
  redirect(`${back}?saved=${encodeURIComponent('Cost category removed.')}`);
}
