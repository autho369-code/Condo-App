export const VENDOR_PERFORMANCE_WINDOW_DAYS = 365;

const DAY_MS = 86_400_000;
const OPEN_STATUSES = new Set(['new', 'assigned', 'scheduled', 'in_progress']);
const DONE_STATUSES = new Set(['done', 'completed', 'billed', 'closed']);

export const VENDOR_COMPLIANCE_FIELDS = [
  'workers_comp_expiration',
  'general_liability_expiration',
  'auto_insurance_expiration',
  'epa_certification_expiration',
  'state_license_expiration',
  'contract_expiration',
] as const;

export type VendorComplianceField = (typeof VENDOR_COMPLIANCE_FIELDS)[number];

export type VendorPerformanceWorkOrder = {
  id?: string;
  vendor_id?: string | null;
  number?: string | null;
  title?: string | null;
  status: string | null;
  priority: string | null;
  created_at: string;
  scheduled_date: string | null;
  completed_date: string | null;
};

export type VendorComplianceRecord = Partial<Record<VendorComplianceField, string | null>>;

export type VendorPerformanceTone = 'neutral' | 'success' | 'warning' | 'danger';

export type VendorPerformanceScorecard = {
  asOfDate: string;
  windowDays: number;
  completed: number;
  open: number;
  overdue: number;
  scheduledCompletions: number;
  onTimeCompletions: number;
  onTimeRate: number | null;
  averageCompletionDays: number | null;
  emergencyAverageCompletionDays: number | null;
  serviceRecord: {
    label: 'Exceptional' | 'Strong' | 'Watch' | 'Needs attention' | 'Building history';
    tone: VendorPerformanceTone;
    evidence: string;
  };
  compliance: {
    current: number;
    expiringSoon: number;
    expired: number;
    notRecorded: number;
    label: 'No recorded issues' | 'Expiring soon' | 'Action required' | 'Not documented';
    tone: VendorPerformanceTone;
  };
};

function normalizedStatus(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function elapsedDays(start: string, end: string): number | null {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return (endMs - startMs) / DAY_MS;
}

function serviceRecord(onTimeRate: number | null, evidenceCount: number): VendorPerformanceScorecard['serviceRecord'] {
  if (onTimeRate === null || evidenceCount < 3) {
    return {
      label: 'Building history',
      tone: 'neutral',
      evidence: `${evidenceCount}/3 scheduled completions needed`,
    };
  }
  if (onTimeRate >= 95) return { label: 'Exceptional', tone: 'success', evidence: `${evidenceCount} scheduled completions` };
  if (onTimeRate >= 85) return { label: 'Strong', tone: 'success', evidence: `${evidenceCount} scheduled completions` };
  if (onTimeRate >= 70) return { label: 'Watch', tone: 'warning', evidence: `${evidenceCount} scheduled completions` };
  return { label: 'Needs attention', tone: 'danger', evidence: `${evidenceCount} scheduled completions` };
}

/**
 * Build an explainable vendor scorecard from recorded work orders and dates.
 * No subjective rating is stored or inferred: every label is derived from the
 * visible on-time percentage, and a minimum evidence threshold prevents a
 * single job from becoming a misleading performance grade.
 */
export function buildVendorPerformanceScorecard(
  workOrders: VendorPerformanceWorkOrder[],
  complianceRecord: VendorComplianceRecord,
  options: { asOf?: Date; windowDays?: number } = {},
): VendorPerformanceScorecard {
  const asOf = options.asOf ?? new Date();
  const windowDays = options.windowDays ?? VENDOR_PERFORMANCE_WINDOW_DAYS;
  const asOfDate = dateOnly(asOf);
  const windowStart = new Date(asOf.getTime() - windowDays * DAY_MS);
  const windowStartDate = dateOnly(windowStart);

  const openRows = workOrders.filter((row) => OPEN_STATUSES.has(normalizedStatus(row.status)));
  const completedRows = workOrders.filter((row) => {
    if (!DONE_STATUSES.has(normalizedStatus(row.status))) return false;
    return Boolean(row.completed_date) && row.completed_date!.slice(0, 10) >= windowStartDate;
  });
  const resolvedRows = completedRows.flatMap((row) => {
    if (!row.completed_date) return [];
    const days = elapsedDays(row.created_at, row.completed_date);
    return days === null ? [] : [{ row, days }];
  });
  const scheduledRows = resolvedRows.filter(({ row }) => Boolean(row.scheduled_date));
  const onTimeCompletions = scheduledRows.filter(({ row }) => row.completed_date!.slice(0, 10) <= row.scheduled_date!.slice(0, 10)).length;
  const onTimeRate = scheduledRows.length > 0 ? Math.round((onTimeCompletions / scheduledRows.length) * 100) : null;
  const averageCompletionDays = resolvedRows.length > 0
    ? resolvedRows.reduce((sum, item) => sum + item.days, 0) / resolvedRows.length
    : null;
  const emergencyRows = resolvedRows.filter(({ row }) => normalizedStatus(row.priority) === 'emergency');
  const emergencyAverageCompletionDays = emergencyRows.length > 0
    ? emergencyRows.reduce((sum, item) => sum + item.days, 0) / emergencyRows.length
    : null;

  const compliance = VENDOR_COMPLIANCE_FIELDS.reduce(
    (counts, field) => {
      const value = complianceRecord[field];
      if (!value) {
        counts.notRecorded += 1;
      } else if (value.slice(0, 10) < asOfDate) {
        counts.expired += 1;
      } else {
        const expiryMs = Date.parse(value);
        const soonMs = asOf.getTime() + 30 * DAY_MS;
        if (Number.isFinite(expiryMs) && expiryMs <= soonMs) counts.expiringSoon += 1;
        else counts.current += 1;
      }
      return counts;
    },
    { current: 0, expiringSoon: 0, expired: 0, notRecorded: 0 },
  );

  const complianceLabel = compliance.expired > 0
    ? { label: 'Action required' as const, tone: 'danger' as const }
    : compliance.expiringSoon > 0
      ? { label: 'Expiring soon' as const, tone: 'warning' as const }
      : compliance.notRecorded === VENDOR_COMPLIANCE_FIELDS.length
        ? { label: 'Not documented' as const, tone: 'neutral' as const }
        : { label: 'No recorded issues' as const, tone: 'success' as const };

  return {
    asOfDate,
    windowDays,
    completed: completedRows.length,
    open: openRows.length,
    overdue: openRows.filter((row) => Boolean(row.scheduled_date) && row.scheduled_date!.slice(0, 10) < asOfDate).length,
    scheduledCompletions: scheduledRows.length,
    onTimeCompletions,
    onTimeRate,
    averageCompletionDays,
    emergencyAverageCompletionDays,
    serviceRecord: serviceRecord(onTimeRate, scheduledRows.length),
    compliance: { ...compliance, ...complianceLabel },
  };
}

export function formatPerformanceDays(value: number | null): string {
  if (value === null) return '—';
  if (value < 1) return `${Math.round(value * 24)}h`;
  return `${value.toFixed(1)}d`;
}
