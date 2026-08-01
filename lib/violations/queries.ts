export type ViolationFilters = {
  associationId?: string;
  status?: string;
  escalation?: string;
  type?: string;
  ownerQuery?: string;
  observedFrom?: string;
};

export const ACTIVE_VIOLATION_STATUSES = ['open', 'notice_sent', 'hearing_pending', 'fined'] as const;
export const CLOSED_VIOLATION_STATUSES = ['cured', 'closed'] as const;

export function buildViolationFilterSummary(filters: ViolationFilters) {
  const summary: string[] = [];
  if (filters.associationId) summary.push('Association selected');
  if (filters.status) summary.push(`Status: ${filters.status}`);
  if (filters.escalation) summary.push(`Escalation: ${filters.escalation}`);
  if (filters.type) summary.push(`Type: ${filters.type}`);
  if (filters.ownerQuery) summary.push(`Search: ${filters.ownerQuery}`);
  if (filters.observedFrom) summary.push(`Observed after ${filters.observedFrom}`);
  return summary;
}

export function isOpenViolationStatus(status: string | null | undefined) {
  return ACTIVE_VIOLATION_STATUSES.includes(status as (typeof ACTIVE_VIOLATION_STATUSES)[number]);
}

export function isHearingPendingViolationStatus(status: string | null | undefined) {
  return status === 'hearing_pending';
}

export function isOverdueViolation(row: { status?: string | null; due_date?: string | null }, todayDate: string) {
  return isOpenViolationStatus(row.status) && !!row.due_date && row.due_date < todayDate;
}
