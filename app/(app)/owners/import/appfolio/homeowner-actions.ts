'use server';

// Homeowners from AppFolio's Homeowner Directory export (parsed in the browser
// by lib/imports/appfolio-homeowners.ts), one AppFolio association at a time,
// into the association the user picked. Units must exist already (the Unit
// Directory import above it on the page creates them).
//
// Owners are created and linked the way the CSV owner import (importOwners in
// ../actions.ts) does it: an owners row, then a current owner occupancy on the
// unit (the occupancies trigger keeps unit_owners in step), then the monthly
// dues through scheduleOwnerDues. Differences, because AppFolio has one row
// per owner per unit:
//   - an owner already linked to that unit (same name or email) is skipped,
//     so running the import again only adds what is missing;
//   - an owner whose email the company already has is reused and linked to
//     this unit (AppFolio lists a multi-unit owner once per unit);
//   - an owner without an email is still imported (preferred contact: mail);
//   - dues are scheduled once per unit, and only when the unit has no current
//     owner with dues yet;
//   - the unit's ownership % is filled in only while it is still 0.
//
// Nothing from the browser is trusted: the association is re-read through the
// signed-in user's session (RLS), units are matched inside that association
// only, names are re-derived from the raw AppFolio value and every other
// value is re-validated here. The whole write runs under the association's
// import lock so two runs cannot both create the same owners.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { parseLabeledPhones } from '@/lib/contacts/labeled-phones';
import { scheduleOwnerDues } from '@/lib/billing/dues-subscription';
import { IMPORT_LOCK_HELD_MESSAGE, withImportLock } from '@/lib/imports/import-lock';
import { homeownerName, parseDues, parseHomeownerPct } from '@/lib/imports/appfolio-homeowners';
import { splitEmails } from '@/lib/imports/appfolio-vendors';
import type { ImportSummary } from '../actions';

/** What the action needs from each parsed homeowner (extra fields are ignored). */
export type HomeownerImportRow = {
  row: string;
  unit_number: string;
  /** The Homeowner cell as exported; the display name is re-derived from it here. */
  raw_name: string;
  electronic_consent: boolean;
  phones: string;
  emails: string[];
  ownership_pct: number | null;
  dues: number | null;
};

const MAX_ROWS = 5000;
const CONCURRENCY = 6;
const PAGE = 1000;

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
/** Unit numbers compare case-insensitively, ignoring spacing around dashes ("3817 - 1" = "3817-1"). */
const unitKey = (v: unknown) => clean(v).toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
/** Names compare on letters and digits only ("Leon & Ariel Abbey" = "leon ariel abbey"). */
const nameKey = (v: unknown) => clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');

async function fetchAll(page: (from: number, to: number) => any): Promise<{ rows: any[]; error?: string }> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { rows };
  }
}

async function inPool<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(fn));
  }
}

type NewOwner = { key: string; line: string; record: Record<string, unknown>; id?: string; error?: string; linked: number };
type Link = {
  line: string;
  unitNumber: string;
  unitId: string;
  label: string;
  ownerId?: string;
  newOwner?: NewOwner;
  dues: number | null;
  pct: number | null;
};

export async function importAppfolioHomeowners(associationId: string, rows: HomeownerImportRow[]): Promise<ImportSummary> {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const fail = (message: string, skipped = Array.isArray(rows) ? rows.length : 0): ImportSummary =>
    ({ imported: 0, skipped, errors: [message] });

  if (!Array.isArray(rows) || rows.length === 0) return fail('The file has no homeowners.', 0);
  if (rows.length > MAX_ROWS) return fail(`Import at most ${MAX_ROWS} homeowners at a time.`);
  if (typeof associationId !== 'string' || !associationId) return fail('No association selected.');

  // The association id comes from the browser: it must be one this user can see.
  const { data: association, error: assocErr } = await db
    .from('associations').select('id, portfolio_id').eq('id', associationId).is('archived_at', null).maybeSingle();
  if (assocErr || !association) {
    return fail(assocErr ? `Could not check the association: ${assocErr.message}` : 'That association was not found or is outside your access.');
  }
  const portfolioId: string | null = association.portfolio_id ?? me.portfolio?.id ?? null;
  if (!portfolioId) return fail('That association has no company.');

  try {
    return await withImportLock(db, associationId, 'appfolio_homeowners', async () => {
      const units = await fetchAll((from, to) => db
        .from('units')
        .select('id, unit_number, ownership_pct, buildings!inner(association_id)')
        .eq('buildings.association_id', associationId)
        .is('archived_at', null)
        .order('id')
        .range(from, to));
      if (units.error) return fail(`Could not load the association's units: ${units.error}`);
      const unitByNumber = new Map<string, { id: string; pct: number }>();
      for (const u of units.rows) unitByNumber.set(unitKey(u.unit_number), { id: u.id, pct: Number(u.ownership_pct ?? 0) });

      // Current owners of the association's units, to skip owners already linked.
      const occupancies = await fetchAll((from, to) => db
        .from('occupancies')
        .select('id, unit_id, owner_id, dues_amount')
        .eq('association_id', associationId)
        .eq('occupancy_type', 'owner')
        .eq('status', 'current')
        .order('id')
        .range(from, to));
      if (occupancies.error) return fail(`Could not load the current homeowners: ${occupancies.error}`);

      // The company's owners (for reuse by email and the already-linked check by name).
      const owners = await fetchAll((from, to) => db
        .from('owners')
        .select('id, full_name, email, emails')
        .eq('portfolio_id', portfolioId)
        .is('archived_at', null)
        .order('id')
        .range(from, to));
      if (owners.error) return fail(`Could not load the company's homeowners: ${owners.error}`);
      const ownerById = new Map<string, { name: string; emails: Set<string> }>();
      const ownerIdByEmail = new Map<string, string>();
      for (const o of owners.rows) {
        const emails = new Set<string>();
        for (const e of [o.email, ...(Array.isArray(o.emails) ? o.emails : [])]) {
          const k = clean(e).toLowerCase();
          if (k) emails.add(k);
        }
        ownerById.set(o.id, { name: nameKey(o.full_name), emails });
        for (const e of emails) if (!ownerIdByEmail.has(e)) ownerIdByEmail.set(e, o.id);
      }

      // Per unit: who is linked now (owner ids, names, emails) and whether dues are already set.
      const linked = new Map<string, { ownerIds: Set<string>; names: Set<string>; emails: Set<string>; hasOwner: boolean; hasDues: boolean }>();
      const unitState = (unitId: string) => {
        let s = linked.get(unitId);
        if (!s) { s = { ownerIds: new Set(), names: new Set(), emails: new Set(), hasOwner: false, hasDues: false }; linked.set(unitId, s); }
        return s;
      };
      for (const o of occupancies.rows) {
        const s = unitState(o.unit_id);
        s.hasOwner = true;
        if (Number(o.dues_amount ?? 0) > 0) s.hasDues = true;
        if (!o.owner_id) continue;
        s.ownerIds.add(o.owner_id);
        const owner = ownerById.get(o.owner_id);
        if (owner) { s.names.add(owner.name); owner.emails.forEach((e) => s.emails.add(e)); }
      }

      let skipped = 0;
      const errors: string[] = [];
      const links: Link[] = [];
      const newOwners = new Map<string, NewOwner>();
      let reused = 0;
      const reusedLines: string[] = [];
      let noEmail = 0;

      // Plan every row first, so owners shared by several rows are created once.
      for (const r of rows) {
        const line = clean(r?.row) || '?';
        const unitNumber = clean(r?.unit_number).slice(0, 40);
        const name = homeownerName(clean(r?.raw_name).slice(0, 500));
        const label = `Line ${line} (${unitNumber || 'no unit'} / ${name.display || 'no name'})`;
        if (!unitNumber || !name.display) { skipped++; errors.push(`${label}: no unit or homeowner name.`); continue; }
        const unit = unitByNumber.get(unitKey(unitNumber));
        if (!unit) { skipped++; errors.push(`${label}: no unit "${unitNumber}" in this association. Import the units first.`); continue; }

        const emails = splitEmails(Array.isArray(r.emails) ? r.emails.filter((e) => typeof e === 'string').join(',') : '').slice(0, 10);
        const state = unitState(unit.id);
        const key = nameKey(name.display);
        if (state.names.has(key) || emails.some((e) => state.emails.has(e))) {
          skipped++;
          errors.push(`${label}: already a homeowner of this unit; left as it is.`);
          continue;
        }

        // Reuse an owner the company has only when both the email and the name match: a shared
        // family or placeholder email must not link another association's owner to this unit.
        const existingId = emails.map((e) => ownerIdByEmail.get(e)).find((id) => id && ownerById.get(id)?.name === key);
        const link: Link = {
          line, unitNumber, unitId: unit.id, label,
          dues: parseDues(clean(r.dues)),
          pct: parseHomeownerPct(clean(r.ownership_pct)),
        };
        if (existingId) {
          if (state.ownerIds.has(existingId)) {
            skipped++;
            errors.push(`${label}: already a homeowner of this unit; left as it is.`);
            continue;
          }
          link.ownerId = existingId;
          state.ownerIds.add(existingId);
          reused++;
          reusedLines.push(`${label}: linked to the existing homeowner with the same name and email.`);
        } else {
          // One new owner per name + email within this file: people sharing a family or
          // placeholder email stay separate owners (same rule as reusing existing owners).
          const ownerKey = `n:${key}|e:${emails[0] ?? ''}`;
          let owner = newOwners.get(ownerKey);
          if (!owner) {
            const phones = parseLabeledPhones(clean(r.phones).slice(0, 500));
            const notes = [
              name.raw !== name.display ? `AppFolio name: ${name.raw}` : null,
              name.notes.length ? `AppFolio note: ${name.notes.join(', ')}` : null,
            ].filter(Boolean).join('\n');
            owner = {
              key: ownerKey,
              line,
              linked: 0,
              record: {
                portfolio_id: portfolioId,
                first_name: name.first_name,
                last_name: name.last_name,
                full_name: name.display.slice(0, 300),
                // owners.email is required; an owner without one is reached by mail.
                email: emails[0] ?? '',
                emails,
                phone: phones.primary,
                phone_numbers: phones.entries,
                preferred_comm: emails.length ? 'email' : 'mail',
                electronic_consent: r.electronic_consent === true,
                electronic_consent_date: r.electronic_consent === true ? new Date().toISOString() : null,
                notes: notes || null,
                created_by: me.auth_user_id,
              },
            };
            newOwners.set(ownerKey, owner);
            if (!emails.length) noEmail++;
          }
          link.newOwner = owner;
        }
        state.names.add(key);
        emails.forEach((e) => state.emails.add(e));
        links.push(link);
      }

      // Create the new owners.
      await inPool([...newOwners.values()], async (o) => {
        const { data, error } = await db.from('owners').insert(o.record).select('id').single();
        if (error || !data) o.error = error?.message ?? 'owner insert failed';
        else o.id = data.id;
      });

      // Link them, unit by unit (rows of one unit in file order: the first new link is primary and carries the dues).
      const byUnit = new Map<string, Link[]>();
      for (const l of links) byUnit.set(l.unitId, [...(byUnit.get(l.unitId) ?? []), l]);
      let imported = 0;
      let pctFilled = 0;
      await inPool([...byUnit.entries()], async ([unitId, unitLinks]) => {
        const state = unitState(unitId);
        for (const l of unitLinks) {
          const ownerId = l.ownerId ?? l.newOwner?.id;
          if (!ownerId) { skipped++; errors.push(`${l.label}: ${l.newOwner?.error ?? 'owner not created'}`); continue; }
          const primary = !state.hasOwner;
          const { data: occ, error: occErr } = await db.from('occupancies').insert({
            owner_id: ownerId,
            unit_id: unitId,
            association_id: associationId,
            occupancy_type: 'owner',
            status: 'current',
            is_primary: primary,
            share_pct: 100,
            dues_amount: l.dues ?? 0,
            dues_frequency: 'monthly',
          }).select('id').single();
          if (occErr || !occ) { skipped++; errors.push(`${l.label}: ${occErr?.message ?? 'could not link the owner to the unit'}`); continue; }
          imported++;
          state.hasOwner = true;
          if (l.newOwner) l.newOwner.linked++;

          // Dues: once per unit, only when no current owner has them yet (co-owners share the unit's schedule).
          if (l.dues !== null && l.dues > 0 && !state.hasDues) {
            const duesErr = await scheduleOwnerDues(db, occ.id, null);
            if (duesErr) errors.push(`${l.label}: owner imported, but ${duesErr}`);
            else state.hasDues = true;
          }

          // Ownership %: only while the unit's is still 0 (never overwrite one someone set).
          const unit = unitByNumber.get(unitKey(l.unitNumber));
          if (unit && l.pct !== null && unit.pct === 0) {
            const { data: changed, error: pctErr } = await db.from('units').update({ ownership_pct: l.pct })
              .eq('id', unitId).eq('ownership_pct', 0).select('id');
            if (pctErr) errors.push(`${l.label}: owner imported, but the unit's ownership % was not set: ${pctErr.message}`);
            else if (changed?.length) { unit.pct = l.pct; pctFilled++; }
          }
        }
      });

      // Don't leave owners with no unit behind (like importOwners): remove ones whose every link failed.
      const orphans = [...newOwners.values()].filter((o) => o.id && o.linked === 0);
      await inPool(orphans, async (o) => {
        const { data: removed, error: undoErr } = await db.from('owners').delete().eq('id', o.id).select('id');
        if (undoErr || !removed?.length) {
          errors.push(`Line ${o.line}: the owner record was created but could not be removed${undoErr ? `: ${undoErr.message}` : '.'}`);
        }
      });

      const created = [...newOwners.values()].filter((o) => o.linked > 0).length;
      const notes: string[] = [];
      if (created) notes.push(`${created} new homeowner record${created === 1 ? '' : 's'} created.`);
      if (reused) notes.push(`${reused} link${reused === 1 ? '' : 's'} went to homeowners the company already had (same name and email).`);
      if (noEmail) notes.push(`${noEmail} homeowner${noEmail === 1 ? ' has' : 's have'} no email in AppFolio; their preferred contact is set to mail.`);
      if (pctFilled) notes.push(`${pctFilled} unit${pctFilled === 1 ? '' : 's'} had no ownership % and now have the one from the export.`);
      errors.unshift(...notes);
      errors.push(...reusedLines);

      revalidatePath('/owners');
      revalidatePath('/units');
      revalidatePath(`/associations/${associationId}/units`);
      return { imported, skipped, errors: errors.length ? errors : undefined };
    });
  } catch (e) {
    const why = e instanceof Error ? e.message : 'The import failed.';
    // The lock was not taken: nothing was written.
    if (why === IMPORT_LOCK_HELD_MESSAGE || why.startsWith('Could not start the import')) return fail(why);
    // Re-running is safe: owners already linked to their unit are skipped.
    return fail(`${why} Some homeowners may already have been added; run the import again to add the rest.`);
  }
}
