/**
 * The date a field capture was observed: the device's local date when the
 * manager saw it (an offline capture may sync days later). Accepted only when
 * plausible — at most one day ahead of the server (a device east of UTC) and
 * at most 90 days old — otherwise today.
 */
export function observedDate(value: string | null | undefined, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return today;
  const days = (Date.parse(`${today}T00:00:00Z`) - date.getTime()) / 86_400_000;
  return days < -1 || days > 90 ? today : value;
}
