'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

// Property groups are company-admin managed (RLS: can_admin_portfolio).
// Actions re-check admin access and scope every id to the caller's portfolio.

const BACK = '/associations/groups';
function fail(msg: string): never {
  redirect(`${BACK}?error=${encodeURIComponent(msg)}`);
}
function done(msg: string): never {
  revalidatePath(BACK);
  revalidatePath('/associations');
  redirect(`${BACK}?saved=${encodeURIComponent(msg)}`);
}

export async function savePropertyGroup(formData: FormData) {
  const me = await requirePortfolioAdmin();
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) fail('Your account is not linked to a portfolio.');
  const id = ((formData.get('id') as string) ?? '').trim() || null;
  const name = ((formData.get('name') as string) ?? '').trim();
  const description = ((formData.get('description') as string) ?? '').trim() || null;
  if (name.length < 2 || name.length > 80) fail('Group names must be 2–80 characters.');
  if (description && description.length > 500) fail('Descriptions are limited to 500 characters.');

  const db = (await createClient()) as any;
  const { data: changed, error } = id
    ? await db.from('property_groups').update({ name, description, updated_at: new Date().toISOString() }).eq('id', id).eq('portfolio_id', portfolioId).select('id')
    : await db.from('property_groups').insert({ portfolio_id: portfolioId, name, description }).select('id');
  if (error) fail(error.message);
  if (id && !changed?.length) fail('Group was not saved: it is gone or your account cannot edit it.');
  done(id ? 'Group updated.' : `Group "${name}" created.`);
}

export async function deletePropertyGroup(formData: FormData) {
  const me = await requirePortfolioAdmin();
  const id = formData.get('id') as string;
  const db = (await createClient()) as any;
  const { data: removed, error } = await db.from('property_groups').delete().eq('id', id).eq('portfolio_id', me.portfolio?.id).select('id');
  if (error) fail(error.message);
  if (!removed?.length) fail('Group was not deleted: it is gone or belongs to another company.');
  done('Group deleted. Its associations are now ungrouped.');
}

/** Set the exact membership of a group from the submitted checkbox list. */
export async function setPropertyGroupMembers(formData: FormData) {
  const me = await requirePortfolioAdmin();
  const portfolioId = me.portfolio?.id;
  const groupId = formData.get('group_id') as string;
  const selected = new Set(formData.getAll('association_ids').map(String));
  const db = (await createClient()) as any;

  const { data: group } = await db.from('property_groups').select('id').eq('id', groupId).eq('portfolio_id', portfolioId).maybeSingle();
  if (!group) fail('Group not found.');

  const { data: associations, error: loadError } = await db
    .from('associations')
    .select('id, property_group_id')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null);
  if (loadError) fail(loadError.message);

  const add = (associations ?? []).filter((a: any) => selected.has(a.id) && a.property_group_id !== groupId).map((a: any) => a.id);
  const remove = (associations ?? []).filter((a: any) => !selected.has(a.id) && a.property_group_id === groupId).map((a: any) => a.id);

  if (add.length) {
    const { data: added, error } = await db.from('associations').update({ property_group_id: groupId }).in('id', add).eq('portfolio_id', portfolioId).select('id');
    if (error) fail(error.message);
    if ((added?.length ?? 0) !== add.length) fail(`Membership was only partly saved: ${added?.length ?? 0} of ${add.length} associations were added. Your account cannot edit the others.`);
  }
  if (remove.length) {
    const { data: removed, error } = await db.from('associations').update({ property_group_id: null }).in('id', remove).eq('portfolio_id', portfolioId).eq('property_group_id', groupId).select('id');
    if (error) fail(error.message);
    if ((removed?.length ?? 0) !== remove.length) fail(`Membership was only partly saved: ${add.length} added, ${removed?.length ?? 0} of ${remove.length} removed. Refresh and try again.`);
  }
  done(`Membership saved: ${add.length} added, ${remove.length} removed.`);
}
