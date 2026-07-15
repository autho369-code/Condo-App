'use server';

// Server actions for automation Flows (create / enable-disable / delete).
// All actions re-check authorization inside the body (requireStaff + the
// session client's RLS scopes every read/write to the caller's portfolio) and
// fail loudly by redirecting back with ?error= per the failTo pattern.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import {
  ACTION_TYPES,
  actionAllowedForTrigger,
  isTriggerType,
  TRIGGER_DEFS,
  type FlowAction,
} from '@/lib/automation/flow-defs';

const LIST_PATH = '/automation-center/flows';

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};

export async function createAutomationFlow(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const trigger = str(formData, 'trigger_type') ?? '';
  const failTo = (msg: string) => {
    redirect(`${LIST_PATH}/new?trigger=${encodeURIComponent(trigger)}&error=${encodeURIComponent(msg)}`);
  };

  if (!me.portfolio?.id) {
    failTo('Your account is not linked to a portfolio. Ask an administrator to assign your profile to a portfolio, then try again.');
  }
  if (!isTriggerType(trigger)) failTo('Choose a valid trigger.');

  const name = str(formData, 'name');
  if (!name) failTo('Give the flow a name.');

  const daysRaw = Number(str(formData, 'days'));
  const days = Number.isFinite(daysRaw) ? Math.floor(daysRaw) : NaN;
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    failTo(`${TRIGGER_DEFS[trigger as keyof typeof TRIGGER_DEFS].daysLabel} must be between 1 and 3650.`);
  }

  // Association scope: '' = all associations in the portfolio. When set,
  // verify the id belongs to the caller's own portfolio (never trust formData).
  const associationId = str(formData, 'association_id');
  if (associationId) {
    const { data: assoc } = await db
      .from('associations')
      .select('id')
      .eq('id', associationId)
      .eq('portfolio_id', me.portfolio.id)
      .maybeSingle();
    if (!assoc) failTo('That association is not in your portfolio.');
  }

  // Actions, in a fixed execution order. Compatibility is validated
  // server-side too — the form only offers compatible actions, but the action
  // body must not trust the client.
  const actions: FlowAction[] = [];
  for (const type of ACTION_TYPES) {
    if (formData.get(`action_${type}`) !== 'on') continue;
    if (!actionAllowedForTrigger(type, trigger as any)) {
      failTo(`The "${type.replace(/_/g, ' ')}" action is not available for this trigger.`);
    }
    if (type === 'email_owner') {
      const subject = str(formData, 'email_subject');
      const body = str(formData, 'email_body');
      if (!subject || !body) failTo('Email the owner needs both a subject and a body.');
      actions.push({ type, config: { subject: subject!, body: body! } });
    } else if (type === 'notify_manager') {
      actions.push({ type, config: { note: str(formData, 'manager_note') ?? '' } });
    } else {
      actions.push({ type, config: {} });
    }
  }
  if (actions.length === 0) failTo('Pick at least one action.');

  const { error } = await db.from('automation_flows').insert({
    portfolio_id: me.portfolio.id,
    association_id: associationId,
    name,
    enabled: true,
    trigger_type: trigger,
    trigger_config: { days },
    actions,
    created_by: me.auth_user_id,
  });
  if (error) failTo(error.message);

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}?success=${encodeURIComponent(`Flow "${name}" created.`)}`);
}

export async function toggleAutomationFlow(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const failTo = (msg: string) => redirect(`${LIST_PATH}?error=${encodeURIComponent(msg)}`);

  const flowId = str(formData, 'flow_id');
  if (!flowId) failTo('Missing flow id.');

  // RLS scopes this read to the caller's portfolio — a foreign id returns
  // nothing, so an out-of-scope toggle fails here.
  const { data: flow } = await db.from('automation_flows').select('id, enabled').eq('id', flowId).maybeSingle();
  if (!flow) failTo('Flow not found in your portfolio.');
  void me;

  const { error } = await db.from('automation_flows').update({ enabled: !flow.enabled }).eq('id', flowId);
  if (error) failTo(error.message);

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function deleteAutomationFlow(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const failTo = (msg: string) => redirect(`${LIST_PATH}?error=${encodeURIComponent(msg)}`);

  const flowId = str(formData, 'flow_id');
  if (!flowId) failTo('Missing flow id.');

  const { data: flow } = await db.from('automation_flows').select('id, name').eq('id', flowId).maybeSingle();
  if (!flow) failTo('Flow not found in your portfolio.');
  void me;

  // Runs cascade with the flow (on delete cascade).
  const { error } = await db.from('automation_flows').delete().eq('id', flowId);
  if (error) failTo(error.message);

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}?success=${encodeURIComponent(`Flow "${flow.name}" deleted.`)}`);
}
