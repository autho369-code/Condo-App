import { todayInZone } from '@/lib/time/zoned';
import { isValidTimeZone } from '@/lib/time/display-zone';

/**
 * Today's date (YYYY-MM-DD) where the association is: owners who moved out
 * today or earlier are former owners there. Falls back to the default zone.
 */
export async function associationToday(db: any, associationId: string): Promise<string> {
  const { data } = await db.from('associations').select('timezone').eq('id', associationId).maybeSingle();
  const zone = typeof data?.timezone === 'string' && isValidTimeZone(data.timezone) ? data.timezone : undefined;
  return todayInZone(zone);
}
