// Inspection compliance: are inspections done by their scheduled date, and are
// their findings resolved? Pure functions over rows the caller already scoped
// (RLS for the live page, portfolio filter for exports), so the page and the
// export compute the same numbers.
import { groupBy, localDate, median } from '@/lib/reports/maintenance-response';

export type ComplianceInspection = {
  id: string;
  association_id: string | null;
  inspection_type: string | null;
  status: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  /** The association's time zone: scheduled and completed dates are local. */
  time_zone?: string | null;
};

export type ComplianceFinding = {
  inspection_id: string;
  severity: string | null;
  resolved: boolean | null;
  resolved_at: string | null;
  work_order_id: string | null;
  created_at: string;
};

export type ComplianceMetrics = {
  inspections: number;
  completed: number;
  onTime: number;
  late: number;
  overdueNow: number;
  /** On time ÷ inspections whose timeliness is known (completed with a date, or past their date). */
  onTimeRate: number | null;
  medianDaysLate: number | null;
  findings: number;
  openFindings: number;
  openSerious: number;
  sentToWorkOrder: number;
  medianDaysToResolve: number | null;
};

export const SEVERITIES = ['critical', 'major', 'moderate', 'minor', 'info'] as const;
const SERIOUS = new Set(['critical', 'major']);
const OPEN = new Set(['scheduled', 'in_progress']);
const DAY = 86_400_000;

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export function complianceMetrics(inspections: ComplianceInspection[], findings: ComplianceFinding[], now = new Date()): ComplianceMetrics {
  let completed = 0, onTime = 0, late = 0, overdueNow = 0;
  const daysLate: number[] = [];
  for (const i of inspections) {
    if (i.completed_date) {
      completed++;
      if (!i.scheduled_date || i.completed_date <= i.scheduled_date) onTime++;
      else {
        late++;
        daysLate.push(dayDiff(i.scheduled_date, i.completed_date));
      }
    } else if (i.status === 'completed') {
      completed++;
    } else if (OPEN.has(String(i.status)) && i.scheduled_date && i.scheduled_date < localDate(now.toISOString(), i.time_zone)) {
      overdueNow++;
    }
  }

  const ids = new Set(inspections.map((i) => i.id));
  const mine = findings.filter((f) => ids.has(f.inspection_id));
  let openFindings = 0, openSerious = 0, sentToWorkOrder = 0;
  const resolveDays: number[] = [];
  for (const f of mine) {
    const resolved = !!f.resolved || !!f.resolved_at;
    if (!resolved) {
      openFindings++;
      if (SERIOUS.has(String(f.severity))) openSerious++;
    } else if (f.resolved_at) {
      resolveDays.push(Math.max(0, (Date.parse(f.resolved_at) - Date.parse(f.created_at)) / DAY));
    }
    if (f.work_order_id) sentToWorkOrder++;
  }

  // A completed inspection without a completion date can't be judged on time or late.
  const known = onTime + late + overdueNow;
  return {
    inspections: inspections.length,
    completed,
    onTime,
    late,
    overdueNow,
    onTimeRate: known > 0 ? onTime / known : null,
    medianDaysLate: median(daysLate),
    findings: mine.length,
    openFindings,
    openSerious,
    sentToWorkOrder,
    medianDaysToResolve: median(resolveDays),
  };
}

/** Findings by severity: total and still open. */
export function findingsBySeverity(findings: ComplianceFinding[]) {
  return SEVERITIES.map((severity) => {
    const rows = findings.filter((f) => f.severity === severity);
    return { severity, total: rows.length, open: rows.filter((f) => !f.resolved && !f.resolved_at).length };
  }).filter((r) => r.total > 0);
}

export const typeLabel = (t: string | null) => (t ? t.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Unspecified');

/** Export rows, the same sections as the live page. */
export function complianceExportRows(
  inspections: ComplianceInspection[],
  findings: ComplianceFinding[],
  associationNames: Map<string, string>,
  now = new Date(),
): Record<string, unknown>[] {
  const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
  const blank = {
    inspections: null, completed: null, on_time: null, late: null, overdue_now: null, on_time_rate: null,
    median_days_late: null, findings: null, open_findings: null, open_critical_or_major: null,
    sent_to_work_order: null, median_days_to_resolve: null, findings_total: null,
  };
  const row = (section: string, group: string, m: ComplianceMetrics): Record<string, unknown> => ({
    section,
    group,
    ...blank,
    inspections: m.inspections,
    completed: m.completed,
    on_time: m.onTime,
    late: m.late,
    overdue_now: m.overdueNow,
    on_time_rate: m.onTimeRate == null ? null : Math.round(m.onTimeRate * 100) / 100,
    median_days_late: round1(m.medianDaysLate),
    findings: m.findings,
    open_findings: m.openFindings,
    open_critical_or_major: m.openSerious,
    sent_to_work_order: m.sentToWorkOrder,
    median_days_to_resolve: round1(m.medianDaysToResolve),
  });
  const byAssoc = groupBy(inspections, (i) => i.association_id ?? '');
  const rows = [...byAssoc.keys()]
    .sort((a, b) => (associationNames.get(a) ?? '').localeCompare(associationNames.get(b) ?? ''))
    .map((id) => row('By association', associationNames.get(id) ?? (id ? 'Association' : 'No association'), complianceMetrics(byAssoc.get(id)!, findings, now)));
  if (rows.length > 0) rows.push(row('By association', 'All associations', complianceMetrics(inspections, findings, now)));
  const byType = groupBy(inspections, (i) => i.inspection_type ?? '');
  for (const t of [...byType.keys()].sort()) rows.push(row('By inspection type', typeLabel(t || null), complianceMetrics(byType.get(t)!, findings, now)));
  const ids = new Set(inspections.map((i) => i.id));
  for (const s of findingsBySeverity(findings.filter((f) => ids.has(f.inspection_id)))) {
    rows.push({ section: 'Findings by severity', group: typeLabel(s.severity), ...blank, findings_total: s.total, open_findings: s.open });
  }
  return rows;
}
