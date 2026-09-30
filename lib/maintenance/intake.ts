import type { Tone } from '@/components/operations/status-chip';

// Labels and response-time helpers for the smart service-request intake
// (see supabase/migrations/*_service_request_smart_intake.sql).

export const ADMIN_TOPIC_LABELS: Record<string, string> = {
  account: 'Billing / account',
  documents: 'Document request',
  insurance: 'Insurance',
  move: 'Move in / out',
  access: 'Keys / access',
  governance: 'Board / governance',
};

export const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'Heating / cooling',
  appliance: 'Appliance',
  pest_control: 'Pest control',
  landscaping: 'Landscaping',
  common_area: 'Common area',
  general_repair: 'General repair',
  other: 'Other',
};

/** Suggested opening line for a reply, by question type. Staff edit before sending. */
export const REPLY_STARTERS: Record<string, string> = {
  account: 'Your ledger is available any time in the owner portal under Ledger. ',
  documents: 'Association documents are posted in the owner portal under Documents. ',
  insurance: 'Thanks for your insurance question. ',
  move: 'Thanks for letting us know about your move. ',
  access: 'Thanks for reaching out about building access. ',
  governance: 'Thanks for your question for the board. ',
};

export function requestKindLabel(kind: string | null | undefined, topic: string | null | undefined, category: string | null | undefined) {
  if (kind === 'admin') return ADMIN_TOPIC_LABELS[topic ?? ''] ?? 'Question';
  return CATEGORY_LABELS[category ?? ''] ?? 'Repair';
}

function hours(ms: number) {
  const h = Math.round(Math.abs(ms) / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.round(Math.abs(ms) / 60_000))}m`;
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export interface ResponseState {
  tone: Tone;
  label: string;
  overdue: boolean;
}

/** First-response state: responded, overdue (and by how much) or time left. */
export function responseState(row: {
  status: string;
  acknowledged_at?: string | null;
  first_response_due_at?: string | null;
}, now = Date.now()): ResponseState | null {
  if (row.acknowledged_at) return { tone: 'success', label: 'Responded', overdue: false };
  if (row.status === 'completed' || row.status === 'cancelled') return null;
  if (!row.first_response_due_at) return null;
  const left = new Date(row.first_response_due_at).getTime() - now;
  if (left < 0) return { tone: 'danger', label: `Overdue ${hours(left)}`, overdue: true };
  return { tone: left < 4 * 3_600_000 ? 'warning' : 'neutral', label: `Reply in ${hours(left)}`, overdue: false };
}
