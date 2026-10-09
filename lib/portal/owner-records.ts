import 'server-only';

/**
 * One owner login can hold several owner records, one per association it was
 * invited to (owner_portal_logins). Pages that work on one record at a time
 * (insurance, contact details) pick it with `?record=` from these.
 */
export type OwnerRecord = { id: string; associationId: string | null; label: string };

export async function loadOwnerRecords(
  db: any,
  me: { owner_id: string | null; owner_ids: string[] },
): Promise<{ records: OwnerRecord[]; error: string | null }> {
  if (!me.owner_ids.length) return { records: [], error: null };
  const { data, error } = await db
    .from('owners')
    .select('id, association_id, associations(name)')
    .in('id', me.owner_ids);
  if (error) return { records: [], error: `Could not load your associations: ${error.message ?? 'unknown error'}` };
  const records = ((data ?? []) as any[]).map((row) => ({
    id: row.id as string,
    associationId: (row.association_id as string | null) ?? null,
    label: (row.associations?.name as string | undefined) ?? 'Association',
  }));
  // The login's first record first, then by association name.
  records.sort((a, b) =>
    a.id === me.owner_id ? -1 : b.id === me.owner_id ? 1 : a.label.localeCompare(b.label));
  return { records, error: null };
}

/** The `?record=` value when it is one of the login's records, else the first record. */
export function pickOwnerRecord(me: { owner_id: string | null; owner_ids: string[] }, raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw : '';
  return me.owner_ids.includes(value) ? value : me.owner_id;
}
