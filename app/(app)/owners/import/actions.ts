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
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { todayInZone } from '@/lib/time/zoned';
import { escapeLike } from '@/lib/db/escape-like';

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
    .from('associations').select('id').eq('id', associationId).is('archived_at', null).maybeSingle();
  if (assocErr || !association) {
    return { imported: 0, skipped: rows.length, errors: [assocErr ? `Could not check the association: ${assocErr.message}` : 'That association was not found or is outside your access.'] };
  }

  const building = await ensureBuilding(db, associationId);
  if ('error' in building) {
    return { imported: 0, skipped: rows.length, errors: [`Could not resolve a building: ${building.error}`] };
  }
  const buildingId = building.id;

  // Cache units we resolve/create this run so multiple owners on the same unit
  // (e.g. co-owners) don't each create a duplicate unit.
  const unitCache = new Map<string, string>();
  // Emails created earlier in this run (lower-cased) — a repeat is a duplicate too.
  const seenEmails = new Set<string>();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 1;
    const unitNumber = clean(r.unit_number);
    const firstName = clean(r.owner_first_name);
    const lastName = clean(r.owner_last_name);
    const email = clean(r.owner_email);

    if (!unitNumber || !firstName || !lastName || !email) {
      skipped++;
      errors.push(`Row ${line}: missing required field (unit_number, owner_first_name, owner_last_name, owner_email).`);
      continue;
    }

    // Never create a second owner record for an email this company already has.
    const emailKey = email.toLowerCase();
    if (seenEmails.has(emailKey)) {
      skipped++;
      errors.push(`Row ${line} (${unitNumber} / ${email}): duplicate — this email appears on an earlier row. Link the extra unit from the owner's page.`);
      continue;
    }
    const { data: existingOwner, error: dupErr } = await db
      .from('owners')
      .select('id')
      .eq('portfolio_id', me.portfolio?.id)
      .ilike('email', escapeLike(email))
      .is('archived_at', null)
      .limit(1)
      .maybeSingle();
    if (dupErr) {
      skipped++;
      errors.push(`Row ${line} (${unitNumber} / ${email}): could not check for an existing owner: ${dupErr.message}`);
      continue;
    }
    if (existingOwner) {
      skipped++;
      errors.push(`Row ${line} (${unitNumber} / ${email}): duplicate — a homeowner with this email already exists. Link the unit from that owner's page.`);
      continue;
    }

    try {
      // find-or-create the unit by unit_number within this building
      let unitId = unitCache.get(unitNumber);
      if (!unitId) {
        const { data: foundUnit, error: unitFindErr } = await db
          .from('units')
          .select('id')
          .eq('building_id', buildingId)
          .eq('unit_number', unitNumber)
          .is('archived_at', null)
          .maybeSingle();
        if (unitFindErr) throw new Error(unitFindErr.message);
        if (foundUnit) {
          unitId = foundUnit.id;
        } else {
          const ownershipPct = num(r.ownership_pct) ?? 0;
          const { data: newUnit, error: unitErr } = await db
            .from('units')
            .insert({ building_id: buildingId, unit_number: unitNumber, ownership_pct: ownershipPct })
            .select('id')
            .single();
          if (unitErr || !newUnit) throw new Error(unitErr?.message ?? 'unit insert failed');
          unitId = newUnit.id;
        }
        unitCache.set(unitNumber, unitId!);
      }

      // create the owner
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      const { data: owner, error: ownerErr } = await db
        .from('owners')
        .insert({
          portfolio_id: me.portfolio?.id,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          email,
          phone: clean(r.owner_phone) || null,
          preferred_comm: 'email',
          created_by: me.auth_user_id,
        })
        .select('id')
        .single();
      if (ownerErr || !owner) throw new Error(ownerErr?.message ?? 'owner insert failed');

      // create the occupancy (owner, current, primary)
      const { error: occErr } = await db.from('occupancies').insert({
        owner_id: owner.id,
        unit_id: unitId,
        association_id: associationId,
        occupancy_type: 'owner',
        status: 'current',
        is_primary: true,
        share_pct: num(r.ownership_pct) ?? 100,
        dues_amount: num(r.monthly_dues) ?? 0,
        dues_frequency: 'monthly',
        move_in_date: toDate(r.move_in_date),
      });
      if (occErr) {
        // Don't leave an owner with no unit behind: remove the record just created.
        const { error: undoErr } = await db.from('owners').delete().eq('id', owner.id).select('id');
        throw new Error(
          undoErr
            ? `${occErr.message} (the owner record was created but could not be removed: ${undoErr.message})`
            : `${occErr.message} (owner not created)`,
        );
      }

      seenEmails.add(emailKey);
      imported++;
    } catch (err: any) {
      skipped++;
      errors.push(`Row ${line} (${unitNumber} / ${email}): ${err?.message ?? 'failed'}`);
    }
  }

  revalidatePath('/owners');
  revalidatePath('/units');
  revalidatePath(`/associations/${associationId}/units`);
  return { imported, skipped, errors: errors.length ? errors : undefined };
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

  revalidatePath('/charges');
  revalidatePath('/units');
  return { imported, skipped, errors: errors.length ? errors : undefined };
}
