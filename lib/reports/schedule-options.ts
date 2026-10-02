import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { displayTimeZone } from '@/lib/time/display-zone';
import { localHourOptions } from '@/lib/reports/schedule';

/** Report pickers and time options for the schedule form (RLS-scoped, complete lists). */
export async function loadScheduleOptions(db: any) {
  const [defs, saved] = await Promise.all([
    fetchAllRows<any>(() => db.from('report_definitions').select('id, name').eq('active', true).order('name').order('id')),
    fetchAllRows<any>(() => db.from('saved_reports').select('id, name').order('name').order('id')),
  ]);
  const zone = displayTimeZone();
  const zoneLabel = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? zone;
  return {
    definitions: defs.rows.map((d) => ({ id: d.id as string, name: d.name as string })),
    customReports: saved.rows.map((r) => ({ id: r.id as string, name: (r.name as string) || 'Untitled report' })),
    hours: localHourOptions(zone),
    zone,
    zoneLabel,
    error: defs.error ?? saved.error,
  };
}
