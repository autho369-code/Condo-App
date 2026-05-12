'use server';

import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function required(value: string | null, label: string) {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function moneyValue(formData: FormData, key: string) {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number(raw.replace(/[$,]/g, ''));
  return Number.isFinite(value) ? value : null;
}

export async function createViolation(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('violations')
    .insert({
      association_id: required(str(formData, 'association_id'), 'Association'),
      unit_id: str(formData, 'unit_id'),
      owner_id: str(formData, 'owner_id'),
      violation_type: str(formData, 'violation_type') ?? 'other',
      title: required(str(formData, 'title'), 'Title'),
      description: str(formData, 'description'),
      date_observed: str(formData, 'date_observed') ?? new Date().toISOString().slice(0, 10),
      reported_date: new Date().toISOString().slice(0, 10),
      due_date: str(formData, 'due_date'),
      cure_deadline: str(formData, 'due_date'),
      hearing_date: str(formData, 'hearing_date'),
      hearing_required: Boolean(str(formData, 'hearing_date')),
      status: str(formData, 'status') ?? 'open',
      fine_amount: moneyValue(formData, 'fine_amount'),
      fine_assessed_at: moneyValue(formData, 'fine_amount') ? new Date().toISOString() : null,
      governing_document_reference: str(formData, 'governing_document_reference'),
      created_by: me.auth_user_id,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/violations');
  redirect(`/violations/${data.id}`);
}
