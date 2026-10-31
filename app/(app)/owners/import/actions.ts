'use server';

// CSV import server actions for onboarding an association's data:
//   1. importOwners          — owners + units (+ buildings) + occupancies + dues
//   2. importOpeningBalances — opening-balance charges that hit each unit's A/R
//
// Both run through the logged-in staff session client so RLS applies (staff
// write policies on owners/units/buildings/occupancies; post_ad_hoc_charge has
// its own can_manage_finance() check). Per-row errors are collected, never
// fatal — one bad row does not abort the rest.
import { revalidatePath } from 'next/cache';
import { parseLabeledPhones } from '@/lib/contacts/labeled-phones';
import { scheduleOwnerDues } from '@/lib/billing/dues-subscription';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { todayInZone } from '@/lib/time/zoned';
import { escapeLike } from '@/lib/db/escape-like';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { IMPORT_LOCK_HELD_MESSAGE, withImportLock } from '@/lib/imports/import-lock';
import { importUnitKey } from '@/lib/imports/unit-key';
import { parseHomeownerPct } from '@/lib/imports/appfolio-homeowners';
import { OPENING_ENTRY_POSTED_MESSAGE, openingEntryPosted } from '@/lib/imports/opening-entry';

export type ImportSummary = { imported: number; skipped: number; errors?: string[] };

function clean(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

function num(v: unknown): number | null {
  const s = clean(v);
  if (!s) return null;
  const n = Number(s.replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Normalize a date-ish string to YYYY-MM-DD, or null if unparseable/blank.
function toDate(v: unknown): string | null {
  const s = clean(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Find the first building for an association, or create a default "Main"
 * building so units (which require building_id NOT NULL) have a home.
 */
async function ensureBuilding(db: any, associationId: string): Promise<{ id: string } | { error: string }> {
  const { data: existing, error: findErr } = await db
    .from('buildings')
    .select('id')
    .eq('association_id', associationId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findErr) return { error: findErr.message };
  if (existing) return { id: existing.id };

  // buildings.address is NOT NULL — supply a placeholder for the default.
  const { data: created, error: createErr } = await db
    .from('buildings')
    .insert({ association_id: associationId, name: 'Main', address: 'Main' })
    .select('id')
    .single();
  if (createErr || !created) return { error: createErr?.message ?? 'Could not create building.' };
  return { id: created.id };
}

export async function importOwners(
  associationId: string,
  rows: Record<string, string>[],
): Promise<ImportSummary> {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  if (!associationId) return { imported: 0, skipped: rows.length, errors: ['No association selected.'] };

  // The association id comes from the client: it must be one this staffer can see.
  const { data: association, error: assocErr } = await db
    .from('associations').select('id, portfolio_id').eq('id', associationId).is('archived_at', null).maybeSingle();
  if (assocErr || !association) {
    return { imported: 0, skipped: rows.length, errors: [assocErr ? `Could not check the association: ${assocErr.message}` : 'That association was not found or is outside your access.'] };
  }
  const portfolioId: string | null = association.portfolio_id ?? null;
  if (!portfolioId) {
    return { imported: 0, skipped: rows.length, errors: ['That association is not linked to a company, so owners cannot be imported into it.'] };
  }

  // The same lock as the previous-system homeowner import: two runs (a double
  // click, a second tab, or both importers at once) must not both create the
  // same units and owners.
  try {
    return await withImportLock(db, portfolioId, 'appfolio_homeowners', async () => {
      // Every unit of the association, in any of its buildings, keyed the way
      // the previous-system imports match them ("3817 - 1" = "3817-1"). Paged:
      // a missed unit would be created twice. A number used in more than one
      // building is ambiguous: such rows are skipped.
      const { rows: existingUnits, error: unitsErr } = await fetchAllRows<any>(() => db
        .from('units')
        .select('id, unit_number, ownership_pct, buildings!inner(association_id)')
        .eq('buildings.association_id', associationId)
        .is('archived_at', null)
        .order('id'));
      if (unitsErr) return { imported: 0, skipped: rows.length, errors: [`Could not load the association's units: ${unitsErr}`] };
      const unitByKey = new Map<string, { id: string; pct: number }>();
      const ambiguousUnits = new Set<string>();
      for (const u of existingUnits ?? []) {
        const k = importUnitKey(u.unit_number);
        if (unitByKey.has(k)) ambiguousUnits.add(k);
        else unitByKey.set(k, { id: u.id, pct: Number(u.ownership_pct ?? 0) });
      }
      for (const k of ambiguousUnits) unitByKey.delete(k);

      // Current owners of those units: a unit that already has one keeps its
      // primary owner and its dues.
      const { rows: currentOwners, error: occupancyErr } = await fetchAllRows<any>(() => db
        .from('occupancies')
        .select('id, unit_id, dues_amount')
        .eq('association_id', associationId)
        .eq('occupancy_type', 'owner')
        .eq('status', 'current')
        .order('id'));
      if (occupancyErr) return { imported: 0, skipped: rows.length, errors: [`Could not load the current homeowners: ${occupancyErr}`] };
      // Per unit: whether it has a current owner, and the dues already set on it.
      const unitStates = new Map<string, { hasOwner: boolean; dues: number | null }>();
      const unitState = (unitId: string) => {
        let s = unitStates.get(unitId);
        if (!s) { s = { hasOwner: false, dues: null }; unitStates.set(unitId, s); }
        return s;
      };
      for (const o of currentOwners ?? []) {
        const s = unitState(o.unit_id);
        s.hasOwner = true;
        if (Number(o.dues_amount ?? 0) > 0 && s.dues === null) s.dues = Number(o.dues_amount);
      }

      // The unit's dues, whichever of its rows carries them (a co-owner row
      // often leaves monthly_dues blank).
      // (Keyed the same way rows look units up; negative dues are ignored.)
      const duesByUnit = new Map<string, number>();
      for (const r of rows) {
        const k = importUnitKey(clean(r.unit_number).slice(0, 40));
        const d = num(r.monthly_dues);
        if (k && d !== null && d >= 0 && !duesByUnit.has(k)) duesByUnit.set(k, d);
      }

      // ownership_pct is each unit's share of the association. A file made
      // from the old template put the OWNER's share there (100, or 50 for
      // co-owners); the units' shares would then add up to far more than
      // 100%. In that case no unit percentage is taken from the file.
      const pctByUnit = new Map<string, number>();
      for (const r of rows) {
        const k = importUnitKey(clean(r.unit_number).slice(0, 40));
        const p = parseHomeownerPct(clean(r.ownership_pct));
        if (k && p !== null && !pctByUnit.has(k)) pctByUnit.set(k, p);
      }
      const filePctTotal = [...pctByUnit.values()].reduce((a, b) => a + b, 0);
      const usePctFromFile = filePctTotal <= 100.5;
      const pctWarning = usePctFromFile ? null : (`ownership_pct: the units' percentages in this file add up to ${Math.round(filePctTotal * 100) / 100}%, more than 100%, so it looks like each owner's share rather than each unit's share of the association. No unit's ownership % was changed; set them on the units page.`);

      let buildingId: string | null = null;
      // Emails created earlier in this run (lower-cased) — a repeat is a duplicate too.
      const seenEmails = new Set<string>();
      let imported = 0;
      let skipped = 0;
      let pctFilled = 0;
      const errors: string[] = [];
      if (pctWarning) errors.push(pctWarning);

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const line = i + 1;
        const unitNumber = clean(r.unit_number).slice(0, 40);
        const firstName = clean(r.owner_first_name);
        const lastName = clean(r.owner_last_name);
        const email = clean(r.owner_email);

        if (!unitNumber || !firstName || !lastName || !email) {
          skipped++;
          errors.push(`Row ${line}: missing required field (unit_number, owner_first_name, owner_last_name, owner_email).`);
          continue;
        }
        const label = `Row ${line} (${unitNumber} / ${email})`;
        const key = importUnitKey(unitNumber);
        if (ambiguousUnits.has(key)) {
          skipped++;
          errors.push(`${label}: unit "${unitNumber}" exists in more than one building; link this owner by hand.`);
          continue;
        }

        // Never create a second owner record for an email this association already
        // has. A homeowner record belongs to one association, so the same person
        // owning in another association of the company is a separate record.
        const emailKey = email.toLowerCase();
        if (seenEmails.has(emailKey)) {
          skipped++;
          errors.push(`${label}: duplicate — this email appears on an earlier row. Link the extra unit from the owner's page.`);
          continue;
        }
        const { data: existingOwner, error: dupErr } = await db
          .from('owners')
          .select('id')
          .eq('association_id', associationId)
          .ilike('email', escapeLike(email))
          .is('archived_at', null)
          .limit(1)
          .maybeSingle();
        if (dupErr) {
          skipped++;
          errors.push(`${label}: could not check for an existing owner: ${dupErr.message}`);
          continue;
        }
        if (existingOwner) {
          skipped++;
          errors.push(`${label}: duplicate — a homeowner of this association with this email already exists. Link the unit from that owner's page.`);
          continue;
        }

        // ownership_pct is the UNIT's share of the association (assessments and
        // votes are split by it), as in the previous-system import: it fills a
        // new unit, or an existing unit still at 0, and is never overwritten.
        const rawPct = clean(r.ownership_pct);
        const pct = usePctFromFile ? parseHomeownerPct(rawPct) : null;
        if (usePctFromFile && rawPct && pct === null) {
          errors.push(`${label}: ownership_pct "${rawPct}" is not a percentage above 0 and up to 100; the unit's ownership % was left as it is.`);
        }

        try {
          // Find the unit in any building of the association, or create it.
          let unit = unitByKey.get(key);
          if (!unit) {
            if (!buildingId) {
              const building = await ensureBuilding(db, associationId);
              if ('error' in building) throw new Error(`Could not resolve a building: ${building.error}`);
              buildingId = building.id;
            }
            const { data: newUnit, error: unitErr } = await db
              .from('units')
              .insert({ building_id: buildingId, unit_number: unitNumber, ownership_pct: pct ?? 0 })
              .select('id')
              .single();
            if (unitErr || !newUnit) throw new Error(unitErr?.message ?? 'unit insert failed');
            unit = { id: String(newUnit.id), pct: pct ?? 0 };
            unitByKey.set(key, unit);
          }
          const unitId = unit.id;

          // create the owner (an exported "Mobile: ..., Home: ..." cell becomes separate numbers)
          const phones = parseLabeledPhones(clean(r.owner_phone));
          const fullName = [firstName, lastName].filter(Boolean).join(' ');
          const { data: owner, error: ownerErr } = await db
            .from('owners')
            .insert({
              // The record belongs to this association; the database derives
              // portfolio_id from it as well.
              association_id: associationId,
              portfolio_id: portfolioId,
              first_name: firstName,
              last_name: lastName,
              full_name: fullName,
              email,
              phone: phones.primary,
              phone_numbers: phones.entries,
              preferred_comm: 'email',
              created_by: me.auth_user_id,
            })
            .select('id')
            .single();
          if (ownerErr || !owner) throw new Error(ownerErr?.message ?? 'owner insert failed');

          // The occupancy. Only the unit's first owner is primary; the unit's
          // dues live on the one occupancy that carries the schedule, so a
          // co-owner (or an owner added to a unit that already has dues)
          // stores none. share_pct is the owner's share of the unit (100, as
          // in the previous-system import), not the unit's percentage.
          const state = unitState(unitId);
          const unitDues = duesByUnit.get(key) ?? null;
          const carriesDues = state.dues === null && unitDues !== null;
          const moveIn = toDate(r.move_in_date);
          const { data: occRow, error: occErr } = await db.from('occupancies').insert({
            owner_id: owner.id,
            unit_id: unitId,
            association_id: associationId,
            occupancy_type: 'owner',
            status: 'current',
            is_primary: !state.hasOwner,
            share_pct: 100,
            dues_amount: carriesDues ? unitDues : 0,
            dues_frequency: 'monthly',
            move_in_date: moveIn,
          }).select('id').single();
          if (occErr || !occRow) {
            // Don't leave an owner with no unit behind: remove the record just created.
            const { error: undoErr } = await db.from('owners').delete().eq('id', owner.id).select('id');
            const why = occErr?.message ?? 'could not link the owner to the unit';
            throw new Error(
              undoErr
                ? `${why} (the owner record was created but could not be removed: ${undoErr.message})`
                : `${why} (owner not created)`,
            );
          }
          state.hasOwner = true;

          // Bill the monthly dues once per unit; a failure keeps the owner but is reported.
          const rowDues = num(r.monthly_dues);
          if (carriesDues) {
            const duesErr = await scheduleOwnerDues(db, occRow.id, moveIn);
            if (duesErr) {
              // Leave this link without dues, so a later co-owner row (or a fix
              // by hand) can carry them, instead of an amount nothing bills.
              const { error: resetErr } = await db.from('occupancies').update({ dues_amount: 0 }).eq('id', occRow.id);
              errors.push(resetErr
                ? `${label}: owner imported, but ${duesErr}, and the dues amount could not be cleared (${resetErr.message}). Fix the unit's dues by hand.`
                : `${label}: owner imported, but ${duesErr}. Set the unit's dues by hand.`);
            } else {
              state.dues = unitDues;
            }
          } else if (rowDues !== null && state.dues !== null && rowDues !== state.dues) {
            // Co-owners share one dues schedule: flag a conflicting amount
            // instead of silently picking one.
            errors.push(`${label}: owner imported, but monthly_dues ${rowDues} conflicts with ${state.dues} already set for this unit; kept ${state.dues}. Fix the unit's dues if that is wrong.`);
          }

          // Ownership %: only while the unit's is still 0 (never overwrite one someone set).
          if (pct !== null && unit.pct === 0) {
            const { data: changed, error: pctErr } = await db.from('units').update({ ownership_pct: pct })
              .eq('id', unitId).eq('ownership_pct', 0).select('id');
            if (pctErr) errors.push(`${label}: owner imported, but the unit's ownership % was not set: ${pctErr.message}`);
            else if (changed?.length) { unit.pct = pct; pctFilled++; }
          }

          seenEmails.add(emailKey);
          imported++;
        } catch (err: any) {
          skipped++;
          errors.push(`${label}: ${err?.message ?? 'failed'}`);
        }
      }

      if (pctFilled) errors.unshift(`${pctFilled} existing unit${pctFilled === 1 ? '' : 's'} had no ownership % and now have the one from the file.`);
      revalidatePath('/owners');
      revalidatePath('/units');
      revalidatePath(`/associations/${associationId}/units`);
      return { imported, skipped, errors: errors.length ? errors : undefined };
    });
  } catch (e) {
    const why = e instanceof Error ? e.message : 'The import failed.';
    // The lock was not taken: nothing was written.
    if (why === IMPORT_LOCK_HELD_MESSAGE || why.startsWith('Could not start the import')) {
      return { imported: 0, skipped: rows.length, errors: [why] };
    }
    return { imported: 0, skipped: rows.length, errors: [`${why} Some owners may already have been added; check the owner list before importing again.`] };
  }
}

export async function importOpeningBalances(
  associationId: string,
  rows: Record<string, string>[],
): Promise<ImportSummary> {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  if (!associationId) return { imported: 0, skipped: rows.length, errors: ['No association selected.'] };

  // Resolve the portfolio "Other" charge category to post the opening balance
  // through the same charges path the engine already uses (post_ad_hoc_charge
  // → charges → unit_balances / receivable_payments_ledger). This keeps
  // double-entry intact rather than inserting a raw journal entry.
  const { data: category, error: catErr } = await db
    .from('charge_categories')
    .select('id')
    .eq('portfolio_id', me.portfolio?.id)
    .eq('code', 'OTHER')
    .eq('active', true)
    .maybeSingle();
  if (catErr || !category) {
    return {
      imported: 0,
      skipped: rows.length,
      errors: [`Could not find an "Other" charge category for this portfolio${catErr ? `: ${catErr.message}` : ''}.`],
    };
  }
  const chargeCategoryId = category.id;

  // Map unit_number → unit_id for the association's buildings.
  const { data: assocUnits, error: unitsErr } = await db
    .from('units')
    .select('id, unit_number, buildings!inner(association_id)')
    .eq('buildings.association_id', associationId)
    .is('archived_at', null);
  if (unitsErr) {
    return { imported: 0, skipped: rows.length, errors: [`Could not load units: ${unitsErr.message}`] };
  }
  const unitByNumber = new Map<string, string>();
  for (const u of assocUnits ?? []) unitByNumber.set(clean(u.unit_number), u.id);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // One run at a time per association (a double click or a second tab would
  // post every row twice), under the same lock as the previous-system
  // open-balance import and the trial-balance opening entry.
  try {
    await withImportLock(db, associationId, 'appfolio_receivables', async () => {
      // The trial-balance opening entry already includes the open balances.
      const opening = await openingEntryPosted(db, associationId);
      if (opening.error || opening.posted) {
        skipped = rows.length;
        errors.push(opening.error ?? OPENING_ENTRY_POSTED_MESSAGE);
        return;
      }
      // A rerun of the same file skips rows already posted (same unit,
      // memo, as-of date and amount), recorded by import_opening_balance.
      const { rows: earlier, error: earlierErr } = await fetchAllRows<any>(() => db
        .from('imported_balances')
        .select('id, unit_id, memo, as_of_date, imported_balance')
        .eq('association_id', associationId)
        .order('id'));
      if (earlierErr) {
        skipped = rows.length;
        errors.push(`Could not check for an earlier import: ${earlierErr}`);
        return;
      }
      const postedKey = (unitId: string, memo: string, asOf: string, amount: number) =>
        `${unitId}|${memo}|${asOf}|${Math.round(amount * 100)}`;
      const posted = new Set((earlier ?? []).map((e: any) => postedKey(e.unit_id, e.memo ?? '', e.as_of_date, Number(e.imported_balance))));

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const line = i + 1;
        const unitNumber = clean(r.unit_number);
        const amount = num(r.opening_balance);

        if (!unitNumber || amount == null) {
          skipped++;
          errors.push(`Row ${line}: missing unit_number or a numeric opening_balance.`);
          continue;
        }
        const unitId = unitByNumber.get(unitNumber);
        if (!unitId) {
          skipped++;
          errors.push(`Row ${line}: no unit "${unitNumber}" in this association.`);
          continue;
        }

        try {
          const dueDate = toDate(r.as_of_date) ?? todayInZone();
          const description = clean(r.memo) || 'Opening balance';
          if (posted.has(postedKey(unitId, description, dueDate, amount))) {
            skipped++;
            errors.push(`Row ${line} (${unitNumber}): already imported; skipped.`);
            continue;
          }
          // One transaction: the charge and the record of what the previous
          // system reported (for Import Variances) succeed or fail together.
          const { error: postErr } = await db.rpc('import_opening_balance', {
            p_unit_id: unitId,
            p_charge_category_id: chargeCategoryId,
            p_amount: amount,
            p_description: description,
            p_as_of: dueDate,
          });
          if (postErr) throw new Error(postErr.message);
          imported++;
        } catch (err: any) {
          skipped++;
          errors.push(`Row ${line} (${unitNumber}): ${err?.message ?? 'failed'}`);
        }
      }
    });
  } catch (err: any) {
    return { imported, skipped: rows.length - imported, errors: [...errors, err?.message ?? 'The import could not start.'] };
  }

  revalidatePath('/charges');
  revalidatePath('/units');
  return { imported, skipped, errors: errors.length ? errors : undefined };
}

export type AppfolioUnitRow = {
  row: string;
  unit_number: string;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  address: string | null;
  ownership_pct: number | null;
};

const MAX_APPFOLIO_UNITS = 5000;

/**
 * Units from AppFolio's Unit Directory export (parsed in the browser by
 * lib/imports/appfolio.ts) into one association. New units go into its first
 * building (a default "Main" building is created if it has none). A unit
 * that already exists (same unit number in any of its buildings) is left as
 * it is, except that its ownership percentage is filled in when it is still
 * 0 and the export has one; a percentage someone already set is never
 * overwritten. Nothing from the browser is trusted: the association is
 * re-checked and every value is re-validated here.
 */
export async function importAppfolioUnits(
  associationId: string,
  units: AppfolioUnitRow[],
): Promise<ImportSummary> {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  if (!Array.isArray(units) || units.length === 0) return { imported: 0, skipped: 0, errors: ['The file has no units.'] };
  if (units.length > MAX_APPFOLIO_UNITS) {
    return { imported: 0, skipped: units.length, errors: [`Import at most ${MAX_APPFOLIO_UNITS} units at a time.`] };
  }
  if (!associationId) return { imported: 0, skipped: units.length, errors: ['No association selected.'] };

  const { data: association, error: assocErr } = await db
    .from('associations').select('id').eq('id', associationId).is('archived_at', null).maybeSingle();
  if (assocErr || !association) {
    return { imported: 0, skipped: units.length, errors: [assocErr ? `Could not check the association: ${assocErr.message}` : 'That association was not found or is outside your access.'] };
  }

  // One units import per association at a time: the existing-unit lookup and the inserts
  // must not interleave with another run (the database key is the exact unit-number text).
  try {
    return await withImportLock(db, associationId, 'appfolio_units', async () => {

      // Paged: PostgREST returns at most 1,000 rows, and a missed unit would be created twice.
      const { rows: existing, error: existingErr } = await fetchAllRows<any>(() => db
        .from('units')
        .select('id, unit_number, ownership_pct, buildings!inner(association_id)')
        .eq('buildings.association_id', associationId)
        .is('archived_at', null)
        .order('id'));
      if (existingErr) return { imported: 0, skipped: units.length, errors: [`Could not load the association's units: ${existingErr}`] };
      // Unit numbers compare case-insensitively, ignoring spacing around dashes ("3817 - 1" =
      // "3817-1"), the same key the homeowner and open-balance imports use. A number used in
      // more than one building is ambiguous: such rows are left alone.
      const unitKey = importUnitKey;
      const have = new Map<string, { id: string; pct: number }>();
      const ambiguous = new Set<string>();
      // Shares of the extra units behind an ambiguous number: not matchable, but they still
      // count toward the association's ownership total.
      let ambiguousPct = 0;
      for (const u of existing ?? []) {
        const k = unitKey(u.unit_number);
        if (have.has(k)) { ambiguous.add(k); ambiguousPct += Number(u.ownership_pct ?? 0); }
        else have.set(k, { id: u.id, pct: Number(u.ownership_pct ?? 0) });
      }

      const building = await ensureBuilding(db, associationId);
      if ('error' in building) return { imported: 0, skipped: units.length, errors: [`Could not resolve a building: ${building.error}`] };

      const positive = (v: unknown, max: number): number | null => {
        const n = typeof v === 'number' ? v : num(v);
        return n !== null && n > 0 && n <= max ? n : null;
      };

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];
      const pending: Array<{ line: string; unitNumber: string; record: Record<string, unknown> }> = [];
      for (const u of units) {
        const line = clean(u?.row) || '?';
        const unitNumber = clean(u?.unit_number).slice(0, 40);
        if (!unitNumber) { skipped++; errors.push(`Line ${line}: no unit name.`); continue; }
        const key = unitKey(unitNumber);
        const pct = positive(u.ownership_pct, 100);
        if (ambiguous.has(key)) {
          skipped++;
          errors.push(`Line ${line} (${unitNumber}): this unit number exists in more than one building; left as it is.`);
          continue;
        }
        const found = have.get(key);
        if (found) {
          if (pct !== null && found.pct === 0) {
            const { data: changed, error: pctErr } = await db.from('units').update({ ownership_pct: pct })
              .eq('id', found.id).eq('ownership_pct', 0).select('id');
            if (pctErr) { skipped++; errors.push(`Line ${line} (${unitNumber}): already exists; its ownership % was not set: ${pctErr.message}`); continue; }
            if (changed?.length) { found.pct = pct; updated++; continue; }
          }
          skipped++;
          errors.push(`Line ${line} (${unitNumber}): already in this association; left as it is.`);
          continue;
        }
        const bedrooms = positive(u.bedrooms, 50);
        const sqft = positive(u.sqft, 1_000_000);
        pending.push({
          line,
          unitNumber,
          record: {
            building_id: building.id,
            unit_number: unitNumber,
            ownership_pct: pct ?? 0,
            sqft: sqft === null ? null : Math.round(sqft),
            bedrooms: bedrooms === null ? null : Math.round(bedrooms),
            bathrooms: positive(u.bathrooms, 50),
            address_override: clean(u.address).slice(0, 300) || null,
          },
        });
        have.set(key, { id: '', pct: pct ?? 0 });
      }

      // New units go in batches (a large property in one request would otherwise
      // be thousands of round trips); a batch that fails is retried row by row so
      // the error names the line.
      for (let i = 0; i < pending.length; i += 200) {
        const batch = pending.slice(i, i + 200);
        const { error: batchErr } = await db.from('units').insert(batch.map((p) => p.record));
        if (!batchErr) { imported += batch.length; continue; }
        for (const p of batch) {
          const { error: rowErr } = await db.from('units').insert(p.record);
          if (rowErr) {
            skipped++;
            errors.push(`Line ${p.line} (${p.unitNumber}): ${rowErr.message}`);
            const k = unitKey(p.unitNumber);
            if (have.get(k)?.id === '') have.delete(k);
          } else {
            imported++;
          }
        }
      }

      // Ownership shares should total 100% across the association (assessments
      // and votes are split by them): say so when they don't.
      const total = [...have.values()].reduce((sum, u) => sum + u.pct, ambiguousPct);
      if (total > 0 && Math.abs(total - 100) > 0.01) {
        errors.push(`Ownership percentages in this association now total ${Math.round(total * 10000) / 10000}%, not 100%. Check the units' ownership % before billing by share.`);
      }
      if (updated) errors.unshift(`${updated} existing unit${updated === 1 ? '' : 's'} had no ownership % and now have the one from the export.`);

      revalidatePath('/units');
      revalidatePath(`/associations/${associationId}/units`);
      return { imported, skipped, errors: errors.length ? errors : undefined };
    });
  } catch (e) {
    return { imported: 0, skipped: units.length, errors: [e instanceof Error ? e.message : 'The import failed. Try again.'] };
  }
}
