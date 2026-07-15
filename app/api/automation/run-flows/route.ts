/**
 * GET /api/automation/run-flows
 * Hourly cron. Executes every enabled automation flow (trigger→action rules
 * managers define at /automation-center/flows):
 *   1. Evaluate the flow's trigger, scoped to its portfolio (and association
 *      when one is set). Max 200 subjects per flow per run.
 *   2. Skip subjects the flow has already fired for — the UNIQUE
 *      (flow_id, subject_type, subject_id) constraint on automation_flow_runs
 *      is the hard backstop: the run row is inserted FIRST and a conflict
 *      means "already fired, ever".
 *   3. Execute the flow's actions in order, recording each outcome into the
 *      run's detail, then finalize the run status (success/partial/failed).
 * Emails are white-labeled as the management company (fromName =
 * portfolios.company_name, replyTo = support_email) via queueEmails, the same
 * pattern as app/api/insurance/send-reminders/route.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { queueEmails } from '@/lib/email/queue';
import { resolveUnitOwnerId } from '@/lib/notifications/status-change';
import {
  actionAllowedForTrigger,
  isTriggerType,
  renderTemplate,
  triggerDays,
  type ActionType,
  type FlowAction,
  type TriggerType,
} from '@/lib/automation/flow-defs';

export const dynamic = 'force-dynamic';

const SUBJECT_CAP = 200;
const DAY_MS = 86400000;

function isoDateDaysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
}
function isoDateDaysFromNow(n: number): string {
  return new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10);
}
function isoDaysAgoTs(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString();
}
function daysBetween(fromIso: string, toMs = Date.now()): number {
  return Math.max(0, Math.floor((toMs - new Date(fromIso).getTime()) / DAY_MS));
}

/** One concrete record a trigger matched. */
interface Subject {
  subjectType: string;
  subjectId: string;
  associationId: string | null;
  /** For charge/work-order owner resolution. */
  unitId: string | null;
  /** Pre-resolved owner (violation/insurance/arc rows carry owner_id). */
  ownerId: string | null;
  title: string;
  /** Actual days overdue/stale/until-expiry for this subject. */
  days: number;
  /** Only meaningful for overdue charges. */
  amount: string;
}

interface ActionOutcome {
  type: ActionType;
  ok: boolean;
  info: string;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const svc = createServiceClient() as any;
  const flowResults: any[] = [];

  try {
    const { data: flows, error } = await svc
      .from('automation_flows')
      .select('id, portfolio_id, association_id, name, trigger_type, trigger_config, actions, run_count')
      .eq('enabled', true);
    if (error) throw new Error(error.message);

    for (const flow of flows ?? []) {
      try {
        flowResults.push(await runFlow(svc, flow));
      } catch (e: any) {
        flowResults.push({ flow: flow.id, name: flow.name, error: e.message });
      }
    }

    return NextResponse.json({ flows: flowResults.length, results: flowResults });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, results: flowResults }, { status: 500 });
  }
}

async function runFlow(svc: any, flow: any) {
  const result = {
    flow: flow.id,
    name: flow.name,
    trigger: flow.trigger_type,
    candidates: 0,
    fired: 0,
    skippedExisting: 0,
    capped: false,
    failures: [] as string[],
  };

  if (!isTriggerType(flow.trigger_type)) {
    result.failures.push(`unknown trigger_type ${flow.trigger_type}`);
    return result;
  }
  const trigger: TriggerType = flow.trigger_type;
  const days = triggerDays(trigger, flow.trigger_config);
  const actions = (Array.isArray(flow.actions) ? flow.actions : []) as FlowAction[];
  if (actions.length === 0) {
    result.failures.push('flow has no actions');
    return result;
  }

  // ── Scope: the flow's association, or every association in its portfolio ──
  let assocQuery = svc
    .from('associations')
    .select('id, name')
    .eq('portfolio_id', flow.portfolio_id)
    .is('archived_at', null);
  if (flow.association_id) assocQuery = assocQuery.eq('id', flow.association_id);
  const { data: assocs, error: assocErr } = await assocQuery;
  if (assocErr) throw new Error(`associations query failed — ${assocErr.message}`);
  const assocIds: string[] = (assocs ?? []).map((a: any) => a.id);
  const assocNameById = new Map<string, string>((assocs ?? []).map((a: any) => [a.id, a.name]));
  if (assocIds.length === 0) return result; // association outside portfolio or empty portfolio

  // ── Evaluate the trigger ──────────────────────────────────────────────────
  const subjects = await evaluateTrigger(svc, trigger, days, assocIds);
  result.candidates = subjects.length;
  if (subjects.length >= SUBJECT_CAP) {
    result.capped = true;
    console.log(`[run-flows] flow ${flow.id} (${flow.name}) hit the ${SUBJECT_CAP}-subject cap`);
  }
  if (subjects.length === 0) {
    await svc.from('automation_flows').update({ last_run_at: new Date().toISOString() }).eq('id', flow.id);
    return result;
  }

  // ── Skip subjects that already fired (pre-filter; unique index is backstop)
  const { data: existing } = await svc
    .from('automation_flow_runs')
    .select('subject_id')
    .eq('flow_id', flow.id)
    .in('subject_id', subjects.map((s) => s.subjectId));
  const alreadyFired = new Set<string>((existing ?? []).map((r: any) => r.subject_id));

  // ── White-label branding + assigned managers, loaded once per flow ────────
  const { data: pf } = await svc
    .from('portfolios')
    .select('company_name, support_email, support_phone')
    .eq('id', flow.portfolio_id)
    .maybeSingle();
  const brand = {
    companyName: pf?.company_name ?? null,
    supportEmail: pf?.support_email ?? null,
    supportPhone: pf?.support_phone ?? null,
  };

  const managersByAssoc = new Map<string, { email: string; name: string | null }[]>();
  const { data: assignments } = await svc
    .from('association_managers')
    .select('association_id, user_id')
    .in('association_id', assocIds)
    .is('ended_at', null);
  const managerUserIds = Array.from(new Set((assignments ?? []).map((a: any) => a.user_id).filter(Boolean)));
  if (managerUserIds.length > 0) {
    const { data: profiles } = await svc.from('profiles').select('id, email, full_name').in('id', managerUserIds);
    const profileById = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
    for (const a of assignments ?? []) {
      const pr = profileById.get(a.user_id);
      if (!pr?.email) continue;
      const list = managersByAssoc.get(a.association_id) ?? [];
      list.push({ email: pr.email, name: pr.full_name ?? null });
      managersByAssoc.set(a.association_id, list);
    }
  }

  // ── Fire per subject: insert run row FIRST, then execute actions ──────────
  for (const subject of subjects) {
    if (alreadyFired.has(subject.subjectId)) {
      result.skippedExisting++;
      continue;
    }

    const { data: runRow, error: insertErr } = await svc
      .from('automation_flow_runs')
      .insert({ flow_id: flow.id, subject_type: subject.subjectType, subject_id: subject.subjectId, status: 'success' })
      .select('id')
      .single();
    if (insertErr || !runRow) {
      if (insertErr?.code === '23505') {
        result.skippedExisting++; // fired by a concurrent/previous run — the unique constraint held
      } else {
        result.failures.push(`${subject.subjectType} ${subject.subjectId}: run insert failed — ${insertErr?.message}`);
      }
      continue;
    }

    const assocName = subject.associationId ? (assocNameById.get(subject.associationId) ?? '') : '';
    const outcomes: ActionOutcome[] = [];
    for (const action of actions) {
      try {
        outcomes.push(await executeAction(svc, flow, trigger, action, subject, assocName, brand, managersByAssoc));
      } catch (e: any) {
        outcomes.push({ type: action.type, ok: false, info: e.message ?? 'action threw' });
      }
    }

    const okCount = outcomes.filter((o) => o.ok).length;
    const status = okCount === outcomes.length ? 'success' : okCount > 0 ? 'partial' : 'failed';
    const detail = {
      subject: { title: subject.title, association: assocName || null, days: subject.days },
      actions: outcomes,
    };
    await svc.from('automation_flow_runs').update({ status, detail }).eq('id', runRow.id);
    result.fired++;
    if (status !== 'success') {
      result.failures.push(
        `${subject.subjectType} ${subject.subjectId}: ${outcomes.filter((o) => !o.ok).map((o) => `${o.type} — ${o.info}`).join('; ')}`,
      );
    }
  }

  await svc
    .from('automation_flows')
    .update({ last_run_at: new Date().toISOString(), run_count: (flow.run_count ?? 0) + result.fired })
    .eq('id', flow.id);

  return result;
}

/** Trigger evaluation — every query scopes to the flow's association ids. */
async function evaluateTrigger(svc: any, trigger: TriggerType, days: number, assocIds: string[]): Promise<Subject[]> {
  if (trigger === 'charge_overdue') {
    // Resolve the portfolio/association's units first (v_charge_balances has
    // no association column), exactly like /api/billing/assess-late-fees.
    const { data: units, error: unitsErr } = await svc
      .from('units')
      .select('id, buildings!inner(association_id)')
      .in('buildings.association_id', assocIds);
    if (unitsErr) throw new Error(`units query failed — ${unitsErr.message}`);
    const assocByUnit = new Map<string, string>((units ?? []).map((u: any) => [u.id, u.buildings.association_id]));
    const unitIds = Array.from(assocByUnit.keys());
    if (unitIds.length === 0) return [];

    const { data: rows, error } = await svc
      .from('v_charge_balances')
      .select('charge_id, unit_id, balance_due, due_date, description')
      .in('unit_id', unitIds)
      .eq('charge_type', 'assessment')
      .gt('balance_due', 0)
      .lt('due_date', isoDateDaysAgo(days))
      .limit(SUBJECT_CAP);
    if (error) throw new Error(`v_charge_balances query failed — ${error.message}`);
    return (rows ?? []).map((c: any) => ({
      subjectType: 'charge',
      subjectId: c.charge_id,
      associationId: assocByUnit.get(c.unit_id) ?? null,
      unitId: c.unit_id ?? null,
      ownerId: null,
      title: c.description ?? 'Assessment charge',
      days: daysBetween(`${c.due_date}T00:00:00Z`),
      amount: `$${Number(c.balance_due).toFixed(2)}`,
    }));
  }

  if (trigger === 'work_order_stale') {
    // Open-ish statuses per the work_order_status enum: everything before
    // done/completed/billed/closed/cancelled.
    const { data: rows, error } = await svc
      .from('work_orders')
      .select('id, title, unit_id, association_id, updated_at')
      .in('association_id', assocIds)
      .in('status', ['new', 'assigned', 'scheduled', 'in_progress'])
      .is('archived_at', null)
      .lt('updated_at', isoDaysAgoTs(days))
      .limit(SUBJECT_CAP);
    if (error) throw new Error(`work_orders query failed — ${error.message}`);
    return (rows ?? []).map((w: any) => ({
      subjectType: 'work_order',
      subjectId: w.id,
      associationId: w.association_id ?? null,
      unitId: w.unit_id ?? null,
      ownerId: null,
      title: w.title ?? 'Work order',
      days: daysBetween(w.updated_at),
      amount: '',
    }));
  }

  if (trigger === 'violation_stale') {
    const { data: rows, error } = await svc
      .from('violations')
      .select('id, title, owner_id, association_id, updated_at')
      .in('association_id', assocIds)
      .eq('status', 'open')
      .is('archived_at', null)
      .lt('updated_at', isoDaysAgoTs(days))
      .limit(SUBJECT_CAP);
    if (error) throw new Error(`violations query failed — ${error.message}`);
    return (rows ?? []).map((v: any) => ({
      subjectType: 'violation',
      subjectId: v.id,
      associationId: v.association_id ?? null,
      unitId: null,
      ownerId: v.owner_id ?? null,
      title: v.title ?? 'Violation',
      days: daysBetween(v.updated_at),
      amount: '',
    }));
  }

  if (trigger === 'insurance_expiring') {
    const today = isoDateDaysAgo(0);
    const { data: rows, error } = await svc
      .from('insurance_policies')
      .select('id, policy_number, insurance_company, expiration_date, owner_id, association_id')
      .in('association_id', assocIds)
      .is('archived_at', null)
      .in('status', ['active', 'expiring_soon'])
      .gte('expiration_date', today)
      .lte('expiration_date', isoDateDaysFromNow(days))
      .limit(SUBJECT_CAP);
    if (error) throw new Error(`insurance_policies query failed — ${error.message}`);
    return (rows ?? []).map((p: any) => ({
      subjectType: 'insurance_policy',
      subjectId: p.id,
      associationId: p.association_id ?? null,
      unitId: null,
      ownerId: p.owner_id ?? null,
      title: `${p.insurance_company ?? 'Insurance'} policy ${p.policy_number ?? ''}`.trim(),
      // days here = days UNTIL expiration (never negative; expiration >= today)
      days: Math.max(0, Math.round((new Date(`${p.expiration_date}T00:00:00Z`).getTime() - Date.now()) / DAY_MS)),
      amount: '',
    }));
  }

  // arc_pending
  const { data: rows, error } = await svc
    .from('architectural_requests')
    .select('id, title, owner_id, association_id, created_at')
    .in('association_id', assocIds)
    .in('status', ['submitted', 'under_review'])
    .lt('created_at', isoDaysAgoTs(days))
    .limit(SUBJECT_CAP);
  if (error) throw new Error(`architectural_requests query failed — ${error.message}`);
  return (rows ?? []).map((r: any) => ({
    subjectType: 'architectural_request',
    subjectId: r.id,
    associationId: r.association_id ?? null,
    unitId: null,
    ownerId: r.owner_id ?? null,
    title: r.title ?? 'Architectural request',
    days: daysBetween(r.created_at),
    amount: '',
  }));
}

async function executeAction(
  svc: any,
  flow: any,
  trigger: TriggerType,
  action: FlowAction,
  subject: Subject,
  assocName: string,
  brand: { companyName: string | null; supportEmail: string | null; supportPhone: string | null },
  managersByAssoc: Map<string, { email: string; name: string | null }[]>,
): Promise<ActionOutcome> {
  const type = action.type;
  if (!actionAllowedForTrigger(type, trigger)) {
    return { type, ok: false, info: `action not valid for trigger ${trigger}` };
  }
  const companyName = brand.companyName ?? (assocName || 'Your management team');
  const contactLine = [brand.supportEmail, brand.supportPhone].filter(Boolean).join(' · ');
  const signature = `— ${companyName}${contactLine ? `\n${contactLine}` : ''}`;

  if (type === 'email_owner') {
    // Resolve the subject's owner: charge/work-order via unit → unit_owners /
    // occupancies (same helper as status-change notifications); violation,
    // insurance, and ARC rows carry owner_id directly.
    let ownerId = subject.ownerId;
    if (!ownerId && subject.unitId) ownerId = await resolveUnitOwnerId(svc, subject.unitId);
    if (!ownerId) return { type, ok: false, info: 'no owner resolved for subject' };

    const { data: owner } = await svc.from('owners').select('email, full_name').eq('id', ownerId).maybeSingle();
    if (!owner?.email) return { type, ok: false, info: 'owner has no email on file' };

    const vars = {
      owner_name: owner.full_name ?? 'Owner',
      association: assocName,
      title: subject.title,
      days: String(subject.days),
      amount: subject.amount,
    };
    const emailSubject = renderTemplate(String(action.config?.subject ?? ''), vars).trim();
    const emailBody = renderTemplate(String(action.config?.body ?? ''), vars).trim();
    if (!emailSubject || !emailBody) return { type, ok: false, info: 'email subject/body missing' };

    const { error } = await queueEmails(svc, [
      {
        to: owner.email,
        toName: owner.full_name ?? null,
        fromName: companyName,
        replyTo: brand.supportEmail ?? null,
        subject: emailSubject,
        text: `${emailBody}\n\n${signature}`,
        associationId: subject.associationId,
        portfolioId: flow.portfolio_id,
      },
    ]);
    if (error) return { type, ok: false, info: `queue failed — ${error}` };
    return { type, ok: true, info: `queued email to ${owner.email}` };
  }

  if (type === 'notify_manager') {
    let recipients = subject.associationId ? (managersByAssoc.get(subject.associationId) ?? []) : [];
    if (recipients.length === 0 && brand.supportEmail) {
      recipients = [{ email: brand.supportEmail, name: null }];
    }
    if (recipients.length === 0) return { type, ok: false, info: 'no assigned manager and no support email' };

    const vars = {
      owner_name: '',
      association: assocName,
      title: subject.title,
      days: String(subject.days),
      amount: subject.amount,
    };
    const note = renderTemplate(String(action.config?.note ?? ''), vars).trim();
    const context =
      `Flow: ${flow.name}\n` +
      `Subject: ${subject.title}${assocName ? ` (${assocName})` : ''}\n` +
      `Days: ${subject.days}${subject.amount ? `\nBalance due: ${subject.amount}` : ''}`;
    const { error } = await queueEmails(
      svc,
      recipients.map((r) => ({
        to: r.email,
        toName: r.name,
        fromName: companyName,
        replyTo: brand.supportEmail ?? null,
        subject: `Flow "${flow.name}" fired — ${subject.title}${assocName ? ` (${assocName})` : ''}`,
        text: `${note ? `${note}\n\n` : ''}${context}\n\n${signature}`,
        associationId: subject.associationId,
        portfolioId: flow.portfolio_id,
      })),
    );
    if (error) return { type, ok: false, info: `queue failed — ${error}` };
    return { type, ok: true, info: `notified ${recipients.length} manager(s)` };
  }

  if (type === 'apply_late_fee') {
    // Valid only for charge_overdue (enforced above). assess_late_fee is
    // idempotent and re-validates the per-association late-fee rules; null
    // return = the rules said no fee is due.
    const { data: feeChargeId, error } = await svc.rpc('assess_late_fee', { p_charge_id: subject.subjectId });
    if (error) return { type, ok: false, info: `assess_late_fee failed — ${error.message}` };
    return { type, ok: true, info: feeChargeId ? `late fee posted (charge ${feeChargeId})` : 'no fee due per association rules' };
  }

  // raise_work_order_priority — valid only for work_order_stale (enforced above)
  const { data: updated, error } = await svc
    .from('work_orders')
    .update({ priority: 'high' })
    .eq('id', subject.subjectId)
    .not('priority', 'in', '(high,emergency)')
    .select('id');
  if (error) return { type, ok: false, info: `priority update failed — ${error.message}` };
  return { type, ok: true, info: updated?.length ? 'priority raised to high' : 'already high or emergency' };
}
