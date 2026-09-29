'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePortfolioAdmin, requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

// All RPCs re-check authorization and tenant scope in the database.
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
function back(key: 'error' | 'saved', msg: string): never {
  revalidatePath('/delinquencies');
  redirect(`/delinquencies?${key}=${encodeURIComponent(msg)}`);
}
const optionalNumber = (v: string) => (v === '' ? null : Number(v));

export async function applyDelinquencyJurisdiction(formData: FormData) {
  await requirePortfolioAdmin();
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('apply_delinquency_jurisdiction', {
    p_association_id: s(formData, 'association_id'),
    p_state_code: s(formData, 'state_code'),
  });
  if (error) back('error', error.message);
  back('saved', `Applied the ${data} collection profile. Review it with association counsel.`);
}

export async function saveDelinquencyCompliance(formData: FormData) {
  await requirePortfolioAdmin();
  const nums = ['pre_referral_notice_days', 'payment_plan_min_months', 'foreclosure_min_balance', 'foreclosure_min_months'].map((k) => optionalNumber(s(formData, k)));
  if (nums.some((n) => n !== null && !Number.isFinite(n))) back('error', 'Compliance values must be numbers.');
  const [days, planMonths, fcBalance, fcMonths] = nums;
  const db = (await createClient()) as any;
  const { error } = await db.rpc('save_delinquency_compliance', {
    p_association_id: s(formData, 'association_id'),
    p_pre_referral_notice_days: days ?? 30,
    p_notice_method: s(formData, 'notice_method') || 'certified_mail',
    p_payment_plan_offer_required: formData.get('payment_plan_offer_required') === 'on',
    p_payment_plan_min_months: planMonths,
    p_board_vote_required: formData.get('board_vote_required') === 'on',
    p_foreclosure_min_balance: fcBalance,
    p_foreclosure_min_months: fcMonths,
  });
  if (error) back('error', error.message);
  back('saved', 'Collection compliance settings saved.');
}

export async function recordPaymentPlanOffer(formData: FormData) {
  await requireStaff();
  const db = (await createClient()) as any;
  const { error } = await db.rpc('record_delinquency_payment_plan_offer', {
    p_case_id: s(formData, 'case_id'),
    p_offered_on: s(formData, 'offered_on'),
    p_months: Number(s(formData, 'months')),
    p_terms: s(formData, 'terms'),
  });
  if (error) back('error', error.message);
  back('saved', 'Payment-plan offer recorded.');
}

export async function recordBoardReferralVote(formData: FormData) {
  await requireStaff();
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('record_delinquency_board_referral_vote', {
    p_case_id: s(formData, 'case_id'),
    p_meeting_date: s(formData, 'meeting_date'),
    p_votes_for: Number(s(formData, 'votes_for')),
    p_votes_against: Number(s(formData, 'votes_against')),
    p_note: s(formData, 'note'),
  });
  if (error) back('error', error.message);
  back('saved', data === 'approved' ? 'Board approval of referral recorded.' : 'Board declined referral — the case is on hold.');
}
