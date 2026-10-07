'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['draft', 'active', 'renewing', 'expired', 'terminated'] as const;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();

function back(id: string, key: 'error' | 'saved', msg: string): never {
  revalidatePath('/owners/management-agreements');
  redirect(`/owners/management-agreements/${id}?${key}=${encodeURIComponent(msg)}`);
}

export async function updateManagementAgreement(formData: FormData) {
  const me = await requireStaff(); // RLS additionally scopes rows to the caller's portfolio
  const id = s(formData, 'id');
  const db = (await createClient()) as any;
  const portfolioId = me.portfolio?.id;

  const { data: existing } = await db.from('management_agreements').select('id, terms').eq('id', id).maybeSingle();
  if (!existing) back(id, 'error', 'Agreement not found.');

  const name = s(formData, 'name');
  const status = s(formData, 'status');
  const startDate = s(formData, 'start_date');
  const endDate = s(formData, 'end_date') || null;
  const associationId = s(formData, 'association_id') || null;
  const renewalMonths = s(formData, 'renewal_term_months');
  const noticeDays = s(formData, 'termination_notice_days');
  const fee = s(formData, 'management_fee');

  if (name.length < 2 || name.length > 200) back(id, 'error', 'Name must be 2–200 characters.');
  if (!STATUSES.includes(status as any)) back(id, 'error', 'Choose a valid status.');
  if (!startDate) back(id, 'error', 'Start date is required.');
  if (endDate && endDate < startDate) back(id, 'error', 'End date must be after the start date.');
  if (associationId) {
    const { data: assoc } = await db.from('associations').select('id').eq('id', associationId).eq('portfolio_id', portfolioId).maybeSingle();
    if (!assoc) back(id, 'error', 'Association is outside your portfolio.');
  }
  const intOrNull = (v: string, max: number) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > max) back(id, 'error', 'Renewal term and notice days must be whole numbers.');
    return n;
  };
  const feeValue = fee ? Number(fee) : null;
  if (feeValue !== null && (!Number.isFinite(feeValue) || feeValue < 0)) back(id, 'error', 'Management fee must be a positive number.');

  const { data: changed, error } = await db
    .from('management_agreements')
    .update({
      name,
      status,
      start_date: startDate,
      end_date: endDate,
      association_id: associationId,
      auto_renew: formData.get('auto_renew') === 'on',
      renewal_term_months: intOrNull(renewalMonths, 120),
      termination_notice_days: intOrNull(noticeDays, 730),
      notes: s(formData, 'notes') || null,
      terms: { ...(existing.terms ?? {}), management_fee: feeValue, fee_basis: s(formData, 'fee_basis') || null },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id');
  if (error) back(id, 'error', error.message);
  if (!changed?.length) back(id, 'error', 'Agreement was not saved: it is gone or your account cannot edit it.');
  back(id, 'saved', 'Agreement saved.');
}

/** Record execution: board signer name + manager signature, and activate a draft. */
export async function recordAgreementSignatures(formData: FormData) {
  const me = await requireStaff();
  const id = s(formData, 'id');
  const signer = s(formData, 'signed_by_owner');
  const signedOn = s(formData, 'signed_on');
  if (signer.length < 2) back(id, 'error', 'Enter the name of the association signer.');
  if (!signedOn) back(id, 'error', 'Enter the date the agreement was signed.');
  const at = new Date(`${signedOn}T12:00:00`).toISOString();
  const db = (await createClient()) as any;
  const { data: existing } = await db.from('management_agreements').select('status').eq('id', id).maybeSingle();
  if (!existing) back(id, 'error', 'Agreement not found.');

  const { data: changed, error } = await db
    .from('management_agreements')
    .update({
      signed_at: at,
      signed_by_owner: signer,
      owner_signed_at: at,
      owner_signature: signer,
      signed_by_manager: me.auth_user_id,
      manager_signed_at: new Date().toISOString(),
      manager_signature: me.profile?.full_name ?? me.email ?? 'Manager',
      status: existing.status === 'draft' ? 'active' : existing.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id');
  if (error) back(id, 'error', error.message);
  if (!changed?.length) back(id, 'error', 'Signatures were not recorded: the agreement is gone or your account cannot edit it.');
  back(id, 'saved', 'Signatures recorded.');
}
