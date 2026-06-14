// Configurable dashboard reminders. Each alert type has a default lead time
// (days in advance) that staff can override per company in reminder_settings.
// computeReminders() runs each enabled alert against live data and returns
// grouped results for the dashboard widget.

import { date } from '@/lib/utils';

export type AlertType =
  | 'lease_renewal'
  | 'parking_available'
  | 'owner_insurance_expiring'
  | 'renter_insurance_expiring'
  | 'delinquency';

export const ALERT_TYPES: { key: AlertType; label: string; description: string; defaultLeadDays: number; leadLabel: string }[] = [
  { key: 'lease_renewal', label: 'Lease renewals', description: 'Active leases approaching their end date.', defaultLeadDays: 60, leadLabel: 'days before lease end' },
  { key: 'parking_available', label: 'Parking became available', description: 'Spaces freed when a tenant moved out.', defaultLeadDays: 14, leadLabel: 'days since freed' },
  { key: 'owner_insurance_expiring', label: 'Owner insurance expiring', description: 'Owner (HO6) policies nearing expiration.', defaultLeadDays: 30, leadLabel: 'days before expiry' },
  { key: 'renter_insurance_expiring', label: 'Renter insurance expiring', description: 'Tenant renters policies nearing expiration.', defaultLeadDays: 30, leadLabel: 'days before expiry' },
  { key: 'delinquency', label: 'Delinquent accounts', description: 'Units past due on assessments or parking.', defaultLeadDays: 30, leadLabel: 'days past due' },
];

export type ReminderItem = { title: string; detail: string; when: string | null; href: string };
export type ReminderGroup = { key: AlertType; label: string; leadDays: number; items: ReminderItem[] };

type Settings = Map<AlertType, { enabled: boolean; lead_days: number }>;

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export async function computeReminders(db: any, portfolioId: string | undefined): Promise<ReminderGroup[]> {
  if (!portfolioId) return [];

  // Settings (fall back to defaults when no row exists).
  const { data: settingsRows } = await db.from('reminder_settings').select('alert_type, enabled, lead_days').eq('portfolio_id', portfolioId);
  const settings: Settings = new Map();
  for (const r of settingsRows ?? []) settings.set(r.alert_type, { enabled: r.enabled, lead_days: r.lead_days });
  const cfg = (t: AlertType) => settings.get(t) ?? { enabled: true, lead_days: ALERT_TYPES.find((a) => a.key === t)!.defaultLeadDays };

  // Associations in this portfolio (for view-backed queries that aren't RLS-scoped).
  const { data: assocs } = await db.from('associations').select('id').eq('portfolio_id', portfolioId).is('archived_at', null);
  const assocIds = (assocs ?? []).map((a: any) => a.id);

  const today = new Date().toISOString().slice(0, 10);
  const groups: ReminderGroup[] = [];

  // 1) Lease renewals
  {
    const c = cfg('lease_renewal');
    if (c.enabled) {
      const { data } = await db.from('tenants')
        .select('id, first_name, last_name, lease_end, owner_id, units(unit_number)')
        .eq('status', 'active').is('archived_at', null)
        .not('lease_end', 'is', null)
        .gte('lease_end', today).lte('lease_end', daysFromNow(c.lead_days))
        .order('lease_end');
      groups.push({
        key: 'lease_renewal', label: 'Lease renewals', leadDays: c.lead_days,
        items: (data ?? []).map((t: any) => ({
          title: `${t.first_name} ${t.last_name}`,
          detail: `Unit ${t.units?.unit_number ?? '—'} · lease ends ${date(t.lease_end)}`,
          when: t.lease_end,
          href: t.owner_id ? `/owners/${t.owner_id}` : '/owners?view=tenants',
        })),
      });
    }
  }

  // 2) Parking became available (recently released)
  {
    const c = cfg('parking_available');
    if (c.enabled) {
      const { data } = await db.from('parking_assignments')
        .select('id, end_date, parking_spaces(label, associations(name))')
        .eq('status', 'ended').eq('portfolio_id', portfolioId)
        .not('end_date', 'is', null).gte('end_date', daysAgo(c.lead_days))
        .order('end_date', { ascending: false });
      groups.push({
        key: 'parking_available', label: 'Parking became available', leadDays: c.lead_days,
        items: (data ?? []).map((a: any) => ({
          title: `Space ${a.parking_spaces?.label ?? '—'}`,
          detail: `${a.parking_spaces?.associations?.name ?? ''} · freed ${date(a.end_date)}`,
          when: a.end_date,
          href: '/parking',
        })),
      });
    }
  }

  // 3) Owner insurance expiring
  {
    const c = cfg('owner_insurance_expiring');
    if (c.enabled) {
      const { data } = await db.from('insurance_policies')
        .select('id, insurance_company, expiration_date, owner_id, owners(full_name)')
        .not('owner_id', 'is', null).eq('status', 'active').is('archived_at', null)
        .not('expiration_date', 'is', null)
        .gte('expiration_date', today).lte('expiration_date', daysFromNow(c.lead_days))
        .order('expiration_date');
      groups.push({
        key: 'owner_insurance_expiring', label: 'Owner insurance expiring', leadDays: c.lead_days,
        items: (data ?? []).map((p: any) => ({
          title: p.owners?.full_name ?? 'Owner',
          detail: `${p.insurance_company ?? 'Policy'} · expires ${date(p.expiration_date)}`,
          when: p.expiration_date,
          href: p.owner_id ? `/owners/${p.owner_id}` : '/insurance',
        })),
      });
    }
  }

  // 4) Renter insurance expiring
  {
    const c = cfg('renter_insurance_expiring');
    if (c.enabled) {
      const { data } = await db.from('tenants')
        .select('id, first_name, last_name, insurance_expiration, owner_id, units(unit_number)')
        .eq('status', 'active').is('archived_at', null)
        .not('insurance_expiration', 'is', null)
        .gte('insurance_expiration', today).lte('insurance_expiration', daysFromNow(c.lead_days))
        .order('insurance_expiration');
      groups.push({
        key: 'renter_insurance_expiring', label: 'Renter insurance expiring', leadDays: c.lead_days,
        items: (data ?? []).map((t: any) => ({
          title: `${t.first_name} ${t.last_name}`,
          detail: `Unit ${t.units?.unit_number ?? '—'} · expires ${date(t.insurance_expiration)}`,
          when: t.insurance_expiration,
          href: t.owner_id ? `/owners/${t.owner_id}` : '/owners?view=tenants',
        })),
      });
    }
  }

  // 5) Delinquent accounts (past due by at least lead_days)
  {
    const c = cfg('delinquency');
    if (c.enabled && assocIds.length > 0) {
      const cutoff = daysAgo(c.lead_days);
      const { data } = await db.from('delinquent_units')
        .select('unit_id, unit_number, balance, oldest_due, association_id')
        .in('association_id', assocIds)
        .gt('balance', 0)
        .lte('oldest_due', cutoff)
        .order('balance', { ascending: false });
      groups.push({
        key: 'delinquency', label: 'Delinquent accounts', leadDays: c.lead_days,
        items: (data ?? []).map((d: any) => ({
          title: `Unit ${d.unit_number ?? '—'}`,
          detail: `Past due since ${date(d.oldest_due)}`,
          when: d.oldest_due,
          href: d.unit_id ? `/units/${d.unit_id}` : '/charges',
        })),
      });
    }
  }

  return groups;
}
