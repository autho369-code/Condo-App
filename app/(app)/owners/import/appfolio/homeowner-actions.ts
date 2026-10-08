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
/** Names compare on letters and digits only, in any script ("Leon & Ariel Abbey" = "leonarielabbey"). */
const nameKey = (v: unknown) => clean(v).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/** Phone numbers compare on their last 10 digits. */
const phoneKey = (v: unknown) => clean(v).replace(/\D/g, '').slice(-10);

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
    // Locked per company, not per association: owners are looked up and created
    // company-wide, so two associations' imports must not interleave either.
    return await withImportLock(db, portfolioId, 'appfolio_homeowners', async () => {
      const units = await fetchAll((from, to) => db
        .from('units')
        .select('id, unit_number, ownership_pct, buildings!inner(association_id)')
        .eq('buildings.association_id', associationId)
        .is('archived_at', null)
        .order('id')
        .range(from, to));
      if (units.error) return fail(`Could not load the association's units: ${units.error}`);
      const unitByNumber = new Map<string, { id: string; pct: number }>();
      // A unit number used in more than one building is ambiguous: those rows are skipped.
      const ambiguousUnits = new Set<string>();
      for (const u of units.rows) {
        const k = unitKey(u.unit_number);
        if (unitByNumber.has(k)) ambiguousUnits.add(k);
        else unitByNumber.set(k, { id: u.id, pct: Number(u.ownership_pct ?? 0) });
      }
      for (const k of ambiguousUnits) unitByNumber.delete(k);

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
        .select('id, full_name, email, emails, phone')
        .eq('portfolio_id', portfolioId)
        .is('archived_at', null)
        .order('id')
        .range(from, to));
      if (owners.error) return fail(`Could not load the company's homeowners: ${owners.error}`);
      const ownerById = new Map<string, { name: string; emails: Set<string>; phone: string }>();
      const ownerIdsByEmail = new Map<string, string[]>();
      const ownerIdsByPhone = new Map<string, string[]>();
      for (const o of owners.rows) {
        const emails = new Set<string>();
        for (const e of [o.email, ...(Array.isArray(o.emails) ? o.emails : [])]) {
          const k = clean(e).toLowerCase();
          if (k) emails.add(k);
        }
        const ph = phoneKey(o.phone);
        ownerById.set(o.id, { name: nameKey(o.full_name), emails, phone: ph });
        for (const e of emails) ownerIdsByEmail.set(e, [...(ownerIdsByEmail.get(e) ?? []), o.id]);
        if (ph.length >= 7) ownerIdsByPhone.set(ph, [...(ownerIdsByPhone.get(ph) ?? []), o.id]);
      }

      // Per unit: who is linked now (owner ids, names, emails) and whether dues are already set.
      // `rowKey` is set for people planned from this file, unset for owners already linked.
      type Person = { name: string; emails: Set<string>; phone: string; rowKey?: string };
      const linked = new Map<string, { ownerIds: Set<string>; people: Person[]; hasOwner: boolean; hasDues: boolean }>();
      const unitState = (unitId: string) => {
        let s = linked.get(unitId);
        if (!s) { s = { ownerIds: new Set(), people: [], hasOwner: false, hasDues: false }; linked.set(unitId, s); }
        return s;
      };
      // Identity of a row: name + email + phone. With no email and no phone the row is only
      // itself (its line): two such rows never merge.
      const identityKey = (name: string, emails: string[], phone: string, line: string) =>
        emails.length || phone.length >= 7 ? `n:${name}|e:${emails[0] ?? ''}|p:${phone}` : `n:${name}|line:${line}`;
      // Already on this unit?
      // - Another row of this file: only an exact duplicate (same identity). AppFolio lists
      //   each homeowner once per unit, so two rows for one unit are two people.
      // - An owner already linked (an earlier import): same name, and no contact detail
      //   filled on both sides conflicts (keeps re-imports from adding them twice).
      const samePerson = (p: Person, name: string, emails: string[], phone: string, rowKey: string) => {
        if (p.rowKey !== undefined) return p.rowKey === rowKey;
        if (p.name !== name) return false;
        if (emails.length > 0 && p.emails.size > 0 && !emails.some((e) => p.emails.has(e))) return false;
        if (phone.length >= 7 && p.phone.length >= 7 && phone !== p.phone) return false;
        return true;
      };
      // Current owner occupancy per unit and owner name (to retry dues that failed to schedule).
      const occByUnitName = new Map<string, { id: string; dues: number }>();
      for (const o of occupancies.rows) {
        const s = unitState(o.unit_id);
        const ownerName = o.owner_id ? ownerById.get(o.owner_id)?.name : undefined;
        if (ownerName !== undefined) occByUnitName.set(`${o.unit_id}|${ownerName}`, { id: o.id, dues: Number(o.dues_amount ?? 0) });
        s.hasOwner = true;
        if (Number(o.dues_amount ?? 0) > 0) s.hasDues = true;
        if (!o.owner_id) continue;
        s.ownerIds.add(o.owner_id);
        const owner = ownerById.get(o.owner_id);
        if (owner) s.people.push({ name: owner.name, emails: owner.emails, phone: owner.phone });
      }

      let skipped = 0;
      const errors: string[] = [];
      const links: Link[] = [];
      const newOwners = new Map<string, NewOwner>();
      let reused = 0;
      const duesRetries: Array<{ label: string; unitId: string; occupancyId: string; dues: number }> = [];
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
        if (!unit) {
          skipped++;
          errors.push(ambiguousUnits.has(unitKey(unitNumber))
            ? `${label}: unit "${unitNumber}" exists in more than one building; link this homeowner by hand.`
            : `${label}: no unit "${unitNumber}" in this association. Import the units first.`);
          continue;
        }

        const emails = splitEmails(Array.isArray(r.emails) ? r.emails.filter((e) => typeof e === 'string').join(',') : '').slice(0, 10);
        const state = unitState(unit.id);
        const key = nameKey(name.display);
        const rowPhone = phoneKey(parseLabeledPhones(clean(r.phones).slice(0, 500)).primary);
        const rowKey = identityKey(key, emails, rowPhone, line);
        if (state.people.some((p) => samePerson(p, key, emails, rowPhone, rowKey))) {
          skipped++;
          // A unit whose dues failed to schedule last time (dues reset to 0): schedule them now.
          const dues = parseDues(clean(r.dues));
          const occ = occByUnitName.get(`${unit.id}|${key}`);
          if (dues !== null && dues > 0 && !state.hasDues && occ) {
            duesRetries.push({ label, unitId: unit.id, occupancyId: occ.id, dues });
            state.hasDues = true;
          }
          errors.push(`${label}: already a homeowner of this unit; left as it is.`);
          continue;
        }

        // Reuse an owner the company has only when both the email and the name match: a shared
        // family or placeholder email must not link another association's owner to this unit.
        // Without an email, name + phone (the same rule new owners in this file are grouped by).
        const candidates = emails.length
          ? emails.flatMap((e) => ownerIdsByEmail.get(e) ?? [])
          : rowPhone.length >= 7 ? ownerIdsByPhone.get(rowPhone) ?? [] : [];
        const existingId = candidates.find((id) => ownerById.get(id)?.name === key);
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
          reusedLines.push(`${label}: linked to the existing homeowner with the same name and ${emails.length ? 'email' : 'phone'}.`);
        } else {
          // One new owner per identity (name + email + phone; a row with neither is its own
          // owner): the same person on several units becomes one owner, while people who only
          // share a name or a family email stay separate.
          const phones = parseLabeledPhones(clean(r.phones).slice(0, 500));
          const ownerKey = rowKey;
          let owner = newOwners.get(ownerKey);
          if (!owner) {
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
        state.people.push({ name: key, emails: new Set(emails), phone: rowPhone, rowKey });
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
            if (duesErr) {
              // Leave the unit marked "no dues" so running the import again schedules them.
              await db.from('occupancies').update({ dues_amount: 0 }).eq('id', occ.id);
              errors.push(`${l.label}: owner imported, but ${duesErr}. Fix that and run the import again to schedule the dues.`);
            } else state.hasDues = true;
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

      // Dues that failed to schedule on an earlier run.
      let duesScheduled = 0;
      await inPool(duesRetries, async (d) => {
        const { error: setErr } = await db.from('occupancies').update({ dues_amount: d.dues }).eq('id', d.occupancyId);
        const duesErr = setErr ? `dues: ${setErr.message}` : await scheduleOwnerDues(db, d.occupancyId, null);
        if (duesErr) {
          await db.from('occupancies').update({ dues_amount: 0 }).eq('id', d.occupancyId);
          errors.push(`${d.label}: ${duesErr}`);
        } else duesScheduled++;
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
      if (duesScheduled) notes.push(`${duesScheduled} unit${duesScheduled === 1 ? '' : 's'} had no dues schedule and now have one.`);
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
