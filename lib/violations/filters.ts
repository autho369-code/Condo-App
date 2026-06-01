export type ViolationStatusFilter = 'open' | 'overdue';

export function normalizeViolationStatusFilter(status: string | undefined) {
  return status === 'open' || status === 'overdue' ? status : undefined;
}
