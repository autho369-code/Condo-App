'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { ASSOCIATION_SECTIONS } from '@/lib/associations/settings-fields';
import { createClient } from '@/lib/supabase/server';

// All writes are re-authorized in the database: settings through the
// whitelisted update_association_settings() RPC, the rest through RLS
// (can_manage_association) on the owning association.

const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
const back = (fd: FormData) => s(fd, 'back') || `/associations/${s(fd, 'association_id')}/profile`;
function go(path: string, key: 'error' | 'saved', msg: string): never {
  revalidatePath(path.split('?')[0]);
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
}
const num = (v: string) => (v === '' ? null : Number(v));

export async function saveAssociationSection(formData: FormData) {
  await requireStaff();
  const associationId = s(formData, 'association_id');
  const section = ASSOCIATION_SECTIONS.find((x) => x.key === s(formData, 'section'));
  const to = back(formData);
  if (!section) go(to, 'error', 'Unknown section.');

  const values: Record<string, unknown> = {};
  for (const f of section.fields) {
    const raw = s(formData, f.key);
    if (f.type === 'bool') values[f.key] = formData.get(f.key) === 'on';
    else if (['number', 'money', 'percent', 'month'].includes(f.type)) {
      if (raw !== '' && !Number.isFinite(Number(raw))) go(to, 'error', `${f.label} must be a number.`);
      values[f.key] = num(raw);
    } else values[f.key] = raw === '' ? null : raw;
  }
  if (values.state && typeof values.state === 'string') values.state = values.state.toUpperCase().slice(0, 2);

  const db = (await createClient()) as any;
  const { error } = await db.rpc('update_association_settings', { p_association_id: associationId, p_values: values });
  if (error) go(to, 'error', error.message);
  go(to, 'saved', `${section.title} saved.`);
}

// ── Keys ────────────────────────────────────────────────────────────────────
export async function addAssociationKey(formData: FormData) {
  const me = await requireStaff();
  const to = back(formData);
  const label = s(formData, 'label');
  if (!label) go(to, 'error', 'Describe the key.');
  const db = (await createClient()) as any;
  const { error } = await db.from('association_keys').insert({
    association_id: s(formData, 'association_id'), label, key_number: s(formData, 'key_number') || null,
    held_by: s(formData, 'held_by') || null, notes: s(formData, 'notes') || null, created_by: me.auth_user_id,
  });
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Key added.');
}

export async function archiveAssociationKey(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const db = (await createClient()) as any;
  const { error } = await db.from('association_keys').update({ archived_at: new Date().toISOString() })
    .eq('id', s(formData, 'id')).eq('association_id', s(formData, 'association_id'));
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Key removed.');
}

// ── Notes ───────────────────────────────────────────────────────────────────
export async function addAssociationNote(formData: FormData) {
  const me = await requireStaff();
  const to = back(formData);
  const body = s(formData, 'body');
  if (body.length < 2) go(to, 'error', 'Write the note first.');
  if (body.length > 5000) go(to, 'error', 'Notes are limited to 5,000 characters.');
  const db = (await createClient()) as any;
  const { error } = await db.from('association_notes').insert({
    association_id: s(formData, 'association_id'), body, is_standard: formData.get('is_standard') === 'on', created_by: me.auth_user_id,
  });
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Note added.');
}

export async function archiveAssociationNote(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const db = (await createClient()) as any;
  const { error } = await db.from('association_notes').update({ archived_at: new Date().toISOString() })
    .eq('id', s(formData, 'id')).eq('association_id', s(formData, 'association_id'));
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Note archived.');
}

// ── Additional fees ─────────────────────────────────────────────────────────
export async function addAdditionalFee(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const pct = num(s(formData, 'percentage'));
  const amount = num(s(formData, 'amount'));
  if (!s(formData, 'label')) go(to, 'error', 'Name the fee.');
  if (pct === null && amount === null) go(to, 'error', 'Enter a percentage or an amount.');
  if ((pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) || (amount !== null && (!Number.isFinite(amount) || amount < 0))) {
    go(to, 'error', 'Enter a valid percentage (0–100) or amount.');
  }
  const db = (await createClient()) as any;
  const { error } = await db.from('association_additional_fees').insert({
    association_id: s(formData, 'association_id'), label: s(formData, 'label'), gl_account_id: s(formData, 'gl_account_id') || null,
    percentage: pct, amount, suppress: formData.get('suppress') === 'on',
  });
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Additional fee added.');
}

export async function deleteAdditionalFee(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const db = (await createClient()) as any;
  const { error } = await db.from('association_additional_fees').delete().eq('id', s(formData, 'id')).eq('association_id', s(formData, 'association_id'));
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Additional fee removed.');
}

// ── Association insurance ───────────────────────────────────────────────────
export async function addAssociationInsurance(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const money = (k: string) => {
    const v = num(s(formData, k));
    if (v !== null && (!Number.isFinite(v) || v < 0)) go(to, 'error', 'Amounts must be positive numbers.');
    return v;
  };
  const db = (await createClient()) as any;
  const { error } = await db.from('association_insurance_policies').insert({
    association_id: s(formData, 'association_id'),
    coverage_type: s(formData, 'coverage_type'),
    carrier: s(formData, 'carrier'),
    policy_number: s(formData, 'policy_number') || null,
    agent_name: s(formData, 'agent_name') || null,
    agent_email: s(formData, 'agent_email') || null,
    agent_phone: s(formData, 'agent_phone') || null,
    coverage_amount: money('coverage_amount'),
    deductible: money('deductible'),
    annual_premium: money('annual_premium'),
    effective_date: s(formData, 'effective_date') || null,
    expiration_date: s(formData, 'expiration_date') || null,
    notes: s(formData, 'notes') || null,
  });
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Insurance policy added.');
}

export async function archiveAssociationInsurance(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const db = (await createClient()) as any;
  const { error } = await db.from('association_insurance_policies').update({ archived_at: new Date().toISOString() })
    .eq('id', s(formData, 'id')).eq('association_id', s(formData, 'association_id'));
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Policy archived.');
}

// ── Unit groups ─────────────────────────────────────────────────────────────
export async function createUnitGroup(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const name = s(formData, 'name');
  if (!name || name.length > 80) go(to, 'error', 'Group names must be 1–80 characters.');
  const db = (await createClient()) as any;
  const { error } = await db.from('unit_groups').insert({ association_id: s(formData, 'association_id'), name, description: s(formData, 'description') || null });
  if (error) go(to, 'error', /duplicate/i.test(error.message) ? 'A group with that name already exists.' : error.message);
  go(to, 'saved', `Group "${name}" created.`);
}

export async function deleteUnitGroup(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const db = (await createClient()) as any;
  const { error } = await db.from('unit_groups').delete().eq('id', s(formData, 'group_id')).eq('association_id', s(formData, 'association_id'));
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Group deleted.');
}

export async function setUnitGroupMembers(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const groupId = s(formData, 'group_id');
  const unitIds = formData.getAll('unit_ids').map(String).filter(Boolean);
  const db = (await createClient()) as any;
  // RLS verifies the group and every unit belong to the same association.
  // Add the new members first and only then remove the ones no longer
  // selected, so a failure never leaves the group empty.
  const { data: current, error: readError } = await db.from('unit_group_members').select('unit_id').eq('group_id', groupId);
  if (readError) go(to, 'error', readError.message);
  const existing = new Set(((current ?? []) as { unit_id: string }[]).map((m) => m.unit_id));
  const wanted = new Set(unitIds);
  const toAdd = unitIds.filter((u) => !existing.has(u));
  const toRemove = [...existing].filter((u) => !wanted.has(u));
  if (toAdd.length) {
    const { error } = await db.from('unit_group_members').insert(toAdd.map((unit_id) => ({ group_id: groupId, unit_id })));
    if (error) go(to, 'error', error.message);
  }
  if (toRemove.length) {
    const { error: delError } = await db.from('unit_group_members').delete().eq('group_id', groupId).in('unit_id', toRemove);
    if (delError) go(to, 'error', `New members were added, but some could not be removed: ${delError.message}`);
  }
  go(to, 'saved', `Group now has ${unitIds.length} unit${unitIds.length === 1 ? '' : 's'}.`);
}
