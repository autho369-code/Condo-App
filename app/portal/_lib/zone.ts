import 'server-only';
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '@/lib/time/display-zone';

/** The association's zone when it is a valid IANA zone, else the default. */
export function associationZone(zone: string | null | undefined): string {
  return zone && isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
}
