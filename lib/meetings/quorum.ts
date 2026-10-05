// Quorum for a meeting is stored as the number of present attendees required
// (meetings.quorum_requirement). The default comes from the association's
// quorum_percentage applied to its live (unarchived) unit count.

/** Parse a form-entered quorum: whole number 1–100000; '' → undefined; anything else → null. */
export function parseQuorumInput(raw: FormDataEntryValue | null): number | null | undefined {
  const v = String(raw ?? '').trim();
  if (!v) return undefined;
  if (!/^\d+$/.test(v)) return null;
  const n = Number.parseInt(v, 10);
  return n >= 1 && n <= 100000 ? n : null;
}

export function quorumFromPercentage(percentage: number | null | undefined, unitCount: number | null | undefined): number | null {
  const pct = Number(percentage);
  const units = Number(unitCount);
  if (!Number.isFinite(pct) || pct <= 0 || !Number.isFinite(units) || units <= 0) return null;
  return Math.max(1, Math.ceil((pct / 100) * units));
}

/** Default quorum (attendees required) for an association, or null when it cannot be derived. */
export async function defaultQuorumRequirement(db: any, associationId: string): Promise<number | null> {
  const { data: assoc, error } = await db.from('associations')
    .select('quorum_percentage, unit_count').eq('id', associationId).maybeSingle();
  if (error || !assoc || assoc.quorum_percentage == null) return null;
  const { count, error: countError } = await db.from('units')
    .select('id, buildings!inner(association_id)', { count: 'exact', head: true })
    .eq('buildings.association_id', associationId)
    .is('archived_at', null);
  const units = !countError && count ? count : assoc.unit_count;
  return quorumFromPercentage(assoc.quorum_percentage, units);
}
