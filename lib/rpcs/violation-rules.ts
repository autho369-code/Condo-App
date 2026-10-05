'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { claimSubmission, completeSubmission, releaseSubmission, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { deliverStepLetter, retryStepLetter } from '@/lib/violations/deliver-step-letter';

// Every RPC below re-checks can_manage_violations(association) in the
// database; requireStaff here is the in-action guard for callable endpoints.

const str = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
function go(path: string, key: 'error' | 'saved', msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
}

function rulesHref(associationId: string) {
  return `/violations/rules?association_id=${associationId}`;
}

export async function saveHouseRule(formData: FormData) {
  await requireStaff();
  const id = str(formData, 'id') || null;
  const associationId = str(formData, 'association_id');
  const back = id ? `/violations/rules/${id}` : `/violations/rules/new?association_id=${associationId}`;
  const fineRaw = str(formData, 'fine_amount');
  const fine = fineRaw ? Number(fineRaw) : null;
  if (fine !== null && !Number.isFinite(fine)) go(back, 'error', 'Default fine must be a number.');

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('save_house_rule', {
    p_id: id,
    p_association_id: associationId,
    p_rule_number: str(formData, 'rule_number'),
    p_title: str(formData, 'title'),
    p_description: str(formData, 'description'),
    p_action_to_resolve: str(formData, 'action_to_resolve') || null,
    p_category: str(formData, 'category') || null,
    p_default_violation_type: str(formData, 'default_violation_type') || 'other',
    p_fine_amount: fine,
    p_active: formData.get('active') === 'on',
  });
  if (error) go(back, 'error', error.message);
  revalidatePath('/violations/rules');
  redirect(`/violations/rules/${data}?saved=${encodeURIComponent('Rule saved.')}`);
}

export async function archiveHouseRule(formData: FormData) {
  await requireStaff();
  const id = str(formData, 'id');
  const associationId = str(formData, 'association_id');
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('archive_house_rule', { p_id: id });
  if (error) go(`/violations/rules/${id}`, 'error', error.message);
  revalidatePath('/violations/rules');
  go(rulesHref(associationId), 'saved', 'Rule archived.');
}

export async function installStarterRules(formData: FormData) {
  await requireStaff();
  const associationId = str(formData, 'association_id');
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('install_starter_house_rules', { p_association_id: associationId });
  if (error) go(rulesHref(associationId), 'error', error.message);
  revalidatePath('/violations/rules');
  go(rulesHref(associationId), 'saved', data > 0 ? `Added ${data} starter rules and a default follow-up schedule. Review them against your governing documents.` : 'All starter rules were already in this association.');
}

export async function copyHouseRules(formData: FormData) {
  await requireStaff();
  const associationId = str(formData, 'association_id');
  const targets = formData.getAll('target_association_ids').map(String).filter(Boolean);
  if (targets.length === 0) go(rulesHref(associationId), 'error', 'Choose at least one association to copy to.');
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('copy_house_rules', {
    p_source_association_id: associationId,
    p_target_association_ids: targets,
    p_include_schedules: formData.get('include_schedules') === 'on',
  });
  if (error) go(rulesHref(associationId), 'error', error.message);
  revalidatePath('/violations/rules');
  go(rulesHref(associationId), 'saved', `Copied ${data} rule${data === 1 ? '' : 's'} to ${targets.length} association${targets.length === 1 ? '' : 's'}. Rules with the same number were skipped.`);
}

export async function saveViolationSchedule(formData: FormData) {
  await requireStaff();
  const associationId = str(formData, 'association_id');
  const ruleId = str(formData, 'house_rule_id') || null;
  const back = ruleId ? `/violations/rules/${ruleId}` : `/violations/rules/schedule?association_id=${associationId}`;
  let steps: unknown;
  try {
    steps = JSON.parse(str(formData, 'steps') || '[]');
  } catch {
    go(back, 'error', 'Could not read the schedule steps.');
  }
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('save_violation_schedule', {
    p_association_id: associationId,
    p_house_rule_id: ruleId,
    p_steps: steps,
  });
  if (error) go(back, 'error', error.message);
  revalidatePath('/violations/rules');
  go(back, 'saved', ruleId && Array.isArray(steps) && steps.length === 0 ? 'This rule now uses the association default schedule.' : 'Follow-up schedule saved.');
}

export async function saveViolationSettings(formData: FormData) {
  await requireStaff();
  const associationId = str(formData, 'association_id');
  const back = `/violations/rules/schedule?association_id=${associationId}`;
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('save_violation_settings', {
    p_association_id: associationId,
    p_hearing_required_before_fine: formData.get('hearing_required_before_fine') === 'on',
    p_hearing_request_days: Number(str(formData, 'hearing_request_days') || 14),
    p_default_cure_days: Number(str(formData, 'default_cure_days') || 14),
    p_fine_charge_category_id: str(formData, 'fine_charge_category_id') || null,
  });
  if (error) go(back, 'error', error.message);
  go(back, 'saved', 'Fining policy saved.');
}

// ── Violation lifecycle ────────────────────────────────────────────────────

export async function openViolation(formData: FormData) {
  await requireStaff();
  const associationId = str(formData, 'association_id');
  const back = `/violations/new${associationId ? `?association_id=${associationId}` : ''}`;
  if (!associationId) go(back, 'error', 'Choose an association.');
  const supabase = await createClient();
  // A double click or re-sent form must not open the same violation twice
  // (forms without a token, e.g. older tabs, still work).
  let token: string | null = null;
  if (formData.get(SUBMISSION_FIELD)) {
    const claim = await claimSubmission(supabase, formData, 'violation_open');
    if (claim.status === 'error') go(back, 'error', claim.message);
    if (claim.status === 'duplicate') {
      if (claim.resultId) redirect(`/violations/${claim.resultId}`);
      go('/violations', 'error', 'This violation is already being opened. Refresh in a moment to see it.');
    }
    token = (claim as { token: string }).token;
  }
  const { data, error } = await (supabase as any).rpc('open_violation', {
    p_association_id: associationId,
    p_unit_id: str(formData, 'unit_id') || null,
    p_house_rule_id: str(formData, 'house_rule_id') || null,
    p_title: str(formData, 'title') || null,
    p_description: str(formData, 'description') || null,
    p_date_observed: str(formData, 'date_observed') || null,
    p_violation_type: str(formData, 'violation_type') || null,
  });
  if (error) {
    if (token) await releaseSubmission(supabase, token);
    go(back, 'error', error.message);
  }
  if (token && typeof data === 'string') await completeSubmission(supabase, token, data);
  revalidatePath('/violations');
  redirect(`/violations/${data}?saved=${encodeURIComponent('Violation opened. Send the first notice when ready.')}`);
}

function describeStep(result: any): string {
  const parts = [`${result.step_name} recorded`];
  if (Number(result.fee) > 0) parts.push(`$${Number(result.fee).toFixed(2)} fine posted to the unit ledger`);
  if (result.next_followup_on) parts.push(`next follow-up ${result.next_followup_on}`);
  return parts.join(' · ') + '.';
}

export async function advanceViolation(formData: FormData) {
  const me = await requireStaff();
  const id = str(formData, 'id');
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('advance_violation', { p_violation_id: id, p_note: str(formData, 'note') || null });
  if (error) go(`/violations/${id}`, 'error', error.message);
  revalidatePath('/violations');
  // The step is recorded; now send its letter. A delivery failure is reported
  // loudly (the step stays recorded — staff send it with "Send letter for this
  // step" on the violation, which does not advance again).
  let letter: string;
  try {
    letter = await deliverStepLetter(supabase, id, data, me.auth_user_id ?? null);
  } catch (e) {
    go(`/violations/${id}`, 'error', `${describeStep(data)} But the letter was not sent: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
  revalidatePath(`/violations/${id}`);
  go(`/violations/${id}`, 'saved', `${describeStep(data)} ${letter}`);
}

export async function recordViolationHearing(formData: FormData) {
  await requireStaff();
  const id = str(formData, 'id');
  const heldOn = str(formData, 'hearing_at');
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('record_violation_hearing', {
    p_violation_id: id,
    p_decision: str(formData, 'decision'),
    p_hearing_at: heldOn ? new Date(`${heldOn}T12:00:00`).toISOString() : null,
    p_notes: str(formData, 'notes') || null,
  });
  if (error) go(`/violations/${id}`, 'error', error.message);
  revalidatePath('/violations');
  go(`/violations/${id}`, 'saved', 'Hearing decision recorded.');
}

export async function resolveViolation(formData: FormData) {
  await requireStaff();
  const id = str(formData, 'id');
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('resolve_violation', {
    p_violation_id: id,
    p_resolution: str(formData, 'resolution'),
    p_note: str(formData, 'note') || null,
  });
  if (error) go(`/violations/${id}`, 'error', error.message);
  revalidatePath('/violations');
  go(`/violations/${id}`, 'saved', str(formData, 'resolution') === 'cured' ? 'Marked corrected.' : 'Violation closed.');
}

/** Bulk follow-up from the violations queue. Each row runs through the same RPC; failures are reported, not hidden. */
export async function bulkViolationAction(formData: FormData) {
  const me = await requireStaff();
  const action = str(formData, 'bulk_action');
  const ids = formData.getAll('violation_ids').map(String).filter(Boolean).slice(0, 100);
  // Only ever return to the violations queue (an unchecked `back` was an open redirect).
  const backRaw = str(formData, 'back');
  const back = backRaw && /^\/violations(\/[0-9a-z-]+)*(\?[a-z_=&0-9%.+-]*)?$/i.test(backRaw) ? backRaw : '/violations';
  if (ids.length === 0) go(back, 'error', 'Select at least one violation.');
  if (!['advance', 'cured'].includes(action)) go(back, 'error', 'Choose a bulk action.');

  const supabase = await createClient();
  const db = supabase as any;
  let ok = 0;
  const failures: string[] = [];
  for (const id of ids) {
    const { data, error } = action === 'advance'
      ? await db.rpc('advance_violation', { p_violation_id: id, p_note: 'Bulk follow-up' })
      : await db.rpc('resolve_violation', { p_violation_id: id, p_resolution: 'cured', p_note: 'Bulk: marked corrected' });
    if (error) { failures.push(error.message); continue; }
    ok += 1;
    if (action === 'advance') {
      try {
        await deliverStepLetter(supabase, id, data, me.auth_user_id ?? null);
      } catch (e) {
        failures.push(`step recorded but letter not sent (${e instanceof Error ? e.message : 'unknown error'})`);
      }
    }
  }
  revalidatePath('/violations');
  const verb = action === 'advance' ? 'advanced to their next step' : 'marked corrected';
  if (failures.length > 0) {
    const reasons = Array.from(new Set(failures)).slice(0, 3).join(' | ');
    go(back, 'error', `${ok} of ${ids.length} ${verb}. ${failures.length} problem${failures.length === 1 ? '' : 's'}: ${reasons}`);
  }
  go(back, 'saved', `${ok} violation${ok === 1 ? '' : 's'} ${verb}.`);
}

/** Staff printed and mailed a step letter. RLS + the letter trigger allow only to_mail -> mailed. */
export async function markViolationLetterMailed(formData: FormData) {
  await requireStaff();
  const id = str(formData, 'letter_id');
  const backRaw = str(formData, 'back');
  const back = /^\/violations(\/[0-9a-z-]+)*(\?[a-z_=&0-9-]*)?$/i.test(backRaw) ? backRaw : '/violations/letters';
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('violation_letters')
    .update({ mail_status: 'mailed' })
    .eq('id', id)
    .eq('mail_status', 'to_mail')
    .select('violation_id');
  if (error) go(back, 'error', error.message);
  if (!data?.length) go(back, 'error', 'That letter was already marked mailed or is outside your access.');
  revalidatePath('/violations/letters');
  revalidatePath(`/violations/${data[0].violation_id}`);
  go(back, 'saved', 'Letter marked mailed.');
}

// Resident / public reports (violation_cases). Both RPCs re-check
// can_manage_violations(association) and that the report is still open.
export async function convertViolationReport(formData: FormData) {
  await requireStaff();
  const id = str(formData, 'case_id');
  const unitId = str(formData, 'unit_id');
  const ruleId = str(formData, 'house_rule_id');
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('convert_violation_report', {
    p_case_id: id,
    p_unit_id: unitId || null,
    p_house_rule_id: ruleId || null,
    p_title: str(formData, 'title') || null,
  });
  if (error) go('/violations/reports', 'error', error.message);
  revalidatePath('/violations/reports');
  revalidatePath('/violations');
  go(`/violations/${data}`, 'saved', 'Violation opened from the resident report. Send the first notice when ready.');
}

export async function dismissViolationReport(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('dismiss_violation_report', {
    p_case_id: str(formData, 'case_id'),
    p_reason: str(formData, 'reason'),
  });
  if (error) go('/violations/reports', 'error', error.message);
  revalidatePath('/violations/reports');
  go('/violations/reports', 'saved', 'Report dismissed.');
}

/**
 * Send the current step's letter without advancing: if the letter exists, only
 * its email is retried / repeated (no duplicate PDF, portal copy or mail item);
 * otherwise it is written and delivered in full using the terms recorded when
 * the step was taken.
 */
export async function sendCurrentStepLetter(formData: FormData) {
  const me = await requireStaff();
  const id = str(formData, 'id');
  const supabase = await createClient();
  const { data: v } = await (supabase as any).from('violations').select('current_step').eq('id', id).maybeSingle();
  const step = Number(v?.current_step ?? 0);
  if (step < 1) go(`/violations/${id}`, 'error', 'No follow-up step has been recorded yet.');
  let letter: string;
  try {
    // An existing letter only needs its email retried / repeated — this works
    // for every violation, including ones advanced before step terms were saved.
    const retried = await retryStepLetter(supabase, id, step, me.auth_user_id ?? null);
    if (retried) {
      letter = retried;
    } else {
      const { data: terms, error } = await (supabase as any).rpc('violation_current_step_letter', { p_violation_id: id });
      if (error) throw new Error(error.message);
      letter = `${terms.step_name}: ${await deliverStepLetter(supabase, id, terms, me.auth_user_id ?? null)}`;
    }
  } catch (e) {
    go(`/violations/${id}`, 'error', `The letter was not sent: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
  revalidatePath(`/violations/${id}`);
  revalidatePath('/violations/letters');
  go(`/violations/${id}`, 'saved', letter);
}
