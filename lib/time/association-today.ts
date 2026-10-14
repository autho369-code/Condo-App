import { todayInZone } from '@/lib/time/zoned';
import { isValidTimeZone } from '@/lib/time/display-zone';

/**
 * Today's date (YYYY-MM-DD) where the association is: owners who moved out
 * today or earlier are former owners there. An association with no valid
 * time zone uses the default zone; a failed lookup is an error, so a send
 * stops rather than picking owners by the wrong day.
 */
export async function associationToday(
  db: any,
  associationId: string,
): Promise<{ today: string; error: null } | { today: null; error: string }> {
  const { data, error } = await db.from('associations').select('timezone').eq('id', associationId).maybeSingle();
  if (error) return { today: null, error: error.message ?? 'Could not load the association' };
  if (!data) return { today: null, error: 'association not found' };
  const zone = typeof data.timezone === 'string' && isValidTimeZone(data.timezone) ? data.timezone : undefined;
  return { today: todayInZone(zone), error: null };
}
