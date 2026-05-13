'use server';

import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function money(formData: FormData, key: string) {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number(raw.replace(/[$,]/g, ''));
  return Number.isFinite(value) ? value : null;
}

export async function createManagementAgreement(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const ownerId = str(formData, 'owner_id');
  const associationId = str(formData, 'association_id');

  const [{ data: owner }, { data: association }] = await Promise.all([
    ownerId ? db.from('owners').select('full_name').eq('id', ownerId).maybeSingle() : { data: null },
    associationId ? db.from('associations').select('name').eq('id', associationId).maybeSingle() : { data: null },
  ]);

  const name = [association?.name, owner?.full_name, 'Management Agreement'].filter(Boolean).join(' - ');
  const { data, error } = await db
    .from('management_agreements')
    .insert({
      portfolio_id: me.portfolio?.id,
      association_id: associationId,
      owner_id: ownerId,
      name: name || 'Management Agreement',
      start_date: str(formData, 'management_start_date') ?? new Date().toISOString().slice(0, 10),
      status: 'draft',
      notes: str(formData, 'terms'),
      terms: {
        management_fee: money(formData, 'management_fee'),
        signature_due_date: str(formData, 'agreement_signature_due_date'),
        delivery_method: str(formData, 'delivery_method') ?? 'email',
      },
      created_by: me.auth_user_id,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/owners/management-agreements');
  redirect(`/owners/management-agreements?created=${data.id}`);
}
