// The owner's units, their associations and each association's architectural
// review settings (the homeowner instructions and whether online requests are
// taken), for the owner portal's architectural pages.
import { loadOwnPortalUnitIds, unitFilter, type OwnerIds } from '@/lib/portal/own-units';
import { instructionText, type ArcInstructions } from '@/lib/architectural/rules';

export type ArcUnit = { unit_id: string; unit_number: string | null; association_id: string | null };
export type ArcAssociation = { id: string; name: string; instructions: ArcInstructions };

export async function loadOwnArcContext(db: any, ownerIds: OwnerIds): Promise<{
  units: ArcUnit[];
  associations: ArcAssociation[];
  error: string | null;
}> {
  const own = await loadOwnPortalUnitIds(db, ownerIds);
  if (own.error) return { units: [], associations: [], error: own.error };

  // RLS on v_unit_account_summary filters to the units this owner belongs to.
  const { data: units, error: unitsError } = await db
    .from('v_unit_account_summary')
    .select('unit_id, unit_number, association_id')
    .in('unit_id', unitFilter(own.ids));
  if (unitsError) return { units: [], associations: [], error: unitsError.message ?? String(unitsError) };

  const unitRows = ((units ?? []) as ArcUnit[]).filter((u) => u.unit_id);
  const associationIds = Array.from(new Set(unitRows.map((u) => u.association_id).filter((id): id is string => Boolean(id))));
  if (associationIds.length === 0) return { units: unitRows, associations: [], error: null };

  const [{ data: assocs, error: assocError }, { data: settings, error: settingsError }] = await Promise.all([
    db.from('associations').select('id, name').in('id', associationIds),
    db.from('architectural_review_settings')
      .select('association_id, online_requests_disabled, portal_homepage_html, submission_form_html, document_upload_html')
      .in('association_id', associationIds),
  ]);
  const failed = assocError ?? settingsError;
  if (failed) return { units: unitRows, associations: [], error: failed.message ?? String(failed) };

  const settingsById = new Map<string, any>(((settings ?? []) as any[]).map((s) => [s.association_id, s]));
  const associations: ArcAssociation[] = ((assocs ?? []) as Array<{ id: string; name: string }>)
    .map((a) => {
      const s = settingsById.get(a.id);
      return {
        id: a.id,
        name: a.name,
        instructions: {
          portal_homepage_html: instructionText(s?.portal_homepage_html),
          submission_form_html: instructionText(s?.submission_form_html),
          document_upload_html: instructionText(s?.document_upload_html),
          online_requests_disabled: s?.online_requests_disabled === true,
        },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { units: unitRows, associations, error: null };
}
