'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function inviteStaffMember(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const full_name = (formData.get('full_name') as string)?.trim();
  const role = (formData.get('role') as string)?.trim();

  if (!email || !full_name || !role) {
    redirect('/settings/team?tab=staff&error=' + encodeURIComponent('All fields are required.'));
  }

  const { error } = await (supabase as any).rpc('invite_staff', {
    p_email: email,
    p_full_name: full_name,
    p_role: role,
  });

  if (error) {
    redirect('/settings/team?tab=staff&error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/settings/team');
  redirect('/settings/team?tab=staff&ok=1');
}

export async function inviteBoardMemberWizard(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const full_name = (formData.get('full_name') as string)?.trim();
  const association_id = (formData.get('association_id') as string)?.trim();
  const board_role = (formData.get('board_role') as string)?.trim() || null;

  if (!email || !full_name || !association_id) {
    redirect('/settings/team?tab=board&error=' + encodeURIComponent('Name, email, and association are required.'));
  }

  const { error } = await (supabase as any).rpc('invite_board_member', {
    p_email: email,
    p_full_name: full_name,
    p_association_id: association_id,
    p_board_role: board_role,
  });

  if (error) {
    redirect('/settings/team?tab=board&error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/settings/team');
  redirect('/settings/team?tab=board&ok=1');
}

export async function inviteOwnerWizard(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const full_name = (formData.get('full_name') as string)?.trim();
  const association_id = (formData.get('association_id') as string)?.trim();
  const unit_number = (formData.get('unit_number') as string)?.trim();

  if (!email || !full_name || !association_id || !unit_number) {
    redirect('/settings/team?tab=owner&error=' + encodeURIComponent('All fields are required.'));
  }

  const { error } = await (supabase as any).rpc('invite_owner', {
    p_email: email,
    p_full_name: full_name,
    p_association_id: association_id,
    p_unit_number: unit_number,
  });

  if (error) {
    redirect('/settings/team?tab=owner&error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/settings/team');
  redirect('/settings/team?tab=owner&ok=1');
}

export async function inviteVendorWizard(formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const trade = (formData.get('trade') as string)?.trim();

  if (!name || !email || !trade) {
    redirect('/settings/team?tab=vendor&error=' + encodeURIComponent('All fields are required.'));
  }

  const { error } = await (supabase as any).rpc('invite_vendor', {
    p_name: name,
    p_email: email,
    p_trade: trade,
  });

  if (error) {
    redirect('/settings/team?tab=vendor&error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/settings/team');
  redirect('/settings/team?tab=vendor&ok=1');
}

export async function invitePropertyManager(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const full_name = (formData.get('full_name') as string)?.trim();
  const unitIdsRaw = formData.getAll('unit_ids') as string[];

  if (!email || !full_name) {
    redirect('/settings/team?tab=manager&error=' + encodeURIComponent('Name and email are required.'));
  }

  if (unitIdsRaw.length === 0) {
    redirect('/settings/team?tab=manager&error=' + encodeURIComponent('Select at least one property or unit.'));
  }

  const { error } = await (supabase as any).rpc('invite_property_manager', {
    p_email: email,
    p_full_name: full_name,
    p_unit_ids: unitIdsRaw,
  });

  if (error) {
    redirect('/settings/team?tab=manager&error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/settings/team');
  redirect('/settings/team?tab=manager&ok=1');
}
