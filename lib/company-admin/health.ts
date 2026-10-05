// One association "health score" for every company-admin page (Executive
// Dashboard, Associations, Portfolio Health). Each page used to carry its own
// formula, so the same association scored differently depending on the page.

export const OPEN_WORK_ORDER_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress'] as const

export type HealthStatus = 'healthy' | 'warning' | 'critical'

export type HealthInputs = {
  open: number
  overdue: number
  emergency: number
  violations: number
}

export type AssociationHealth = HealthInputs & { score: number; status: HealthStatus }

/** Points deducted from 100 per open item. Shown on the Portfolio Health page. */
export const HEALTH_DEDUCTIONS = {
  open: 4,
  overdue: 12,
  emergency: 15,
  violations: 6,
} as const

export function associationHealthScore(i: HealthInputs): number {
  const raw = 100
    - i.open * HEALTH_DEDUCTIONS.open
    - i.overdue * HEALTH_DEDUCTIONS.overdue
    - i.emergency * HEALTH_DEDUCTIONS.emergency
    - i.violations * HEALTH_DEDUCTIONS.violations
  return Math.max(0, Math.min(100, Math.round(raw)))
}

export function healthStatus(score: number): HealthStatus {
  return score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical'
}

export function healthTone(status: HealthStatus): 'success' | 'warning' | 'danger' {
  return status === 'critical' ? 'danger' : status === 'warning' ? 'warning' : 'success'
}

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
}

/**
 * Aggregate open work orders and active violations per association and score
 * each one. `workOrders` must already be limited to open statuses and
 * `violations` to active ones; rows for associations not in `associationIds`
 * are ignored. `today` is a YYYY-MM-DD date in the company's zone.
 */
export function computeAssociationHealth(
  associationIds: Iterable<string>,
  workOrders: Array<{ association_id: string | null; scheduled_date?: string | null; priority?: string | null }>,
  violations: Array<{ association_id: string | null }>,
  today: string,
): Map<string, AssociationHealth> {
  const inputs = new Map<string, HealthInputs>()
  for (const id of associationIds) inputs.set(id, { open: 0, overdue: 0, emergency: 0, violations: 0 })

  for (const wo of workOrders) {
    const entry = wo.association_id ? inputs.get(wo.association_id) : undefined
    if (!entry) continue
    entry.open++
    if (wo.scheduled_date && wo.scheduled_date < today) entry.overdue++
    if (wo.priority === 'emergency') entry.emergency++
  }
  for (const v of violations) {
    const entry = v.association_id ? inputs.get(v.association_id) : undefined
    if (entry) entry.violations++
  }

  const out = new Map<string, AssociationHealth>()
  for (const [id, i] of inputs) {
    const score = associationHealthScore(i)
    out.set(id, { ...i, score, status: healthStatus(score) })
  }
  return out
}
