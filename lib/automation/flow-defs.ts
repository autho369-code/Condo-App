// Shared vocabulary for automation Flows (trigger→action rules).
// Used by the create-flow UI, the server actions that validate submissions,
// and the /api/automation/run-flows cron so labels, compatibility rules, and
// template rendering never drift apart.

export const TRIGGER_TYPES = [
  'charge_overdue',
  'work_order_stale',
  'violation_stale',
  'insurance_expiring',
  'arc_pending',
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const ACTION_TYPES = [
  'email_owner',
  'notify_manager',
  'apply_late_fee',
  'raise_work_order_priority',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface FlowAction {
  type: ActionType;
  config: Record<string, string>;
}

export interface TriggerDef {
  label: string;
  /** What the {days} threshold means for this trigger. */
  daysLabel: string;
  defaultDays: number;
  /** Human sentence for list rows, e.g. "Dues charge overdue by 15+ days". */
  summary: (days: number) => string;
  /** What the run subject is, for the runs drill-down. */
  subjectLabel: string;
}

export const TRIGGER_DEFS: Record<TriggerType, TriggerDef> = {
  charge_overdue: {
    label: 'Dues charge overdue',
    daysLabel: 'Days past the due date',
    defaultDays: 15,
    summary: (d) => `Dues charge overdue by ${d}+ days`,
    subjectLabel: 'Charge',
  },
  work_order_stale: {
    label: 'Work order stale',
    daysLabel: 'Days without any update',
    defaultDays: 14,
    summary: (d) => `Open work order untouched for ${d}+ days`,
    subjectLabel: 'Work order',
  },
  violation_stale: {
    label: 'Violation stale',
    daysLabel: 'Days without any update',
    defaultDays: 14,
    summary: (d) => `Open violation untouched for ${d}+ days`,
    subjectLabel: 'Violation',
  },
  insurance_expiring: {
    label: 'Insurance expiring',
    daysLabel: 'Days before expiration',
    defaultDays: 30,
    summary: (d) => `Insurance policy expiring within ${d} days`,
    subjectLabel: 'Policy',
  },
  arc_pending: {
    label: 'ARC request pending',
    daysLabel: 'Days since submission',
    defaultDays: 14,
    summary: (d) => `Architectural request undecided for ${d}+ days`,
    subjectLabel: 'ARC request',
  },
};

export interface ActionDef {
  label: string;
  description: string;
  /** When set, the action is valid ONLY for this trigger. */
  onlyFor?: TriggerType;
}

export const ACTION_DEFS: Record<ActionType, ActionDef> = {
  email_owner: {
    label: 'Email the owner',
    description: 'Send a white-labeled email to the owner tied to the record.',
  },
  notify_manager: {
    label: 'Notify the assigned managers',
    description: "Email the association's assigned managers (or the company inbox).",
  },
  apply_late_fee: {
    label: 'Apply the late fee',
    description: "Post the association's configured late fee to the overdue charge.",
    onlyFor: 'charge_overdue',
  },
  raise_work_order_priority: {
    label: 'Raise the work order priority to High',
    description: 'Bump the stale work order to high priority (never downgrades emergency).',
    onlyFor: 'work_order_stale',
  },
};

export function isTriggerType(v: string | null | undefined): v is TriggerType {
  return TRIGGER_TYPES.includes(v as TriggerType);
}

export function actionAllowedForTrigger(action: ActionType, trigger: TriggerType): boolean {
  const only = ACTION_DEFS[action].onlyFor;
  return !only || only === trigger;
}

/** Parse {days} out of trigger_config with a per-trigger fallback. */
export function triggerDays(trigger: TriggerType, config: unknown): number {
  const raw = (config as any)?.days;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : TRIGGER_DEFS[trigger].defaultDays;
}

export function actionsSummary(actions: FlowAction[]): string {
  return actions
    .map((a) => ACTION_DEFS[a.type as ActionType]?.label ?? a.type)
    .join(' → ');
}

/** The variables managers may use in email subject/body/note templates. */
export const TEMPLATE_VARIABLES = ['{{owner_name}}', '{{association}}', '{{title}}', '{{days}}', '{{amount}}'] as const;

export const TEMPLATE_VARIABLES_HINT =
  'Variables: {{owner_name}}, {{association}}, {{title}}, {{days}}, {{amount}} (amount applies to overdue charges; blank otherwise).';

/** Replace {{variable}} placeholders; unknown variables render as empty. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '');
}
