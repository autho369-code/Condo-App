'use server';

// Import the previous system's Vendor Directory export into ONE association's
// vendors (each association has its own vendors; the export is company-wide,
// so the staffer picks the association it belongs to).
//
// The browser parses the CSV (lib/imports/appfolio-vendors) for the preview
// and sends the parsed rows here; nothing from the client is trusted — every
// field is re-validated. Runs through the logged-in staff session client so
// RLS applies (vendors_staff_all + mgr_assoc_scope), and the association is
// re-checked with can_manage_association.
//
// Columns written all exist on public.vendors (supabase/schema-columns.json):
// name, portfolio_id, association_id, phone_numbers, emails, address_*, default_gl_account_id,
// payment_type, send_1099, the six *_expiration dates, notes (moved to
// vendor_private by the vendors_move_private_fields trigger), created_by.
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/me';
import { withImportLock } from '@/lib/imports/import-lock';
import { createClient } from '@/lib/supabase/server';
import { vendorEmails } from '@/lib/vendors/contact';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { parseAppfolioDate, splitEmails, type AppfolioVendor } from '@/lib/imports/appfolio-vendors';

export type VendorImportSummary = { imported: number; skipped: number; errors?: string[] };

const MAX_VENDORS = 5000;
const BATCH = 200;
const PAYMENT_TYPES = ['check', 'echeck', 'ach', 'online'] as const;
const EXPIRATIONS = [
  'workers_comp_expiration',
  'general_liability_expiration',
  'epa_certification_expiration',
  'auto_insurance_expiration',
  'state_license_expiration',
  'contract_expiration',
] as const;

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s ? s.slice(0, max) : null;
};
/** Letters and digits only, in any script. */
const nameKey = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

type VendorInsert = {
  portfolio_id: string;
  association_id: string;
  created_by: string | null;
  name: string;
  phone_numbers: Array<{ number: string; type: string | null }>;
  emails: string[];
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  default_gl_account_id: string | null;
  payment_type: (typeof PAYMENT_TYPES)[number];
  send_1099: boolean;
  notes: string | null;
} & Record<(typeof EXPIRATIONS)[number], string | null>;

type Prepared = { line: string; name: string; insert: VendorInsert };

function phonesOf(v: unknown): VendorInsert['phone_numbers'] {
  if (!Array.isArray(v)) return [];
  const out: VendorInsert['phone_numbers'] = [];
  for (const p of v.slice(0, 10)) {
    const number = str(p?.number, 40);
    if (!number || number.replace(/\D/g, '').length < 7) continue;
    const type = str(p?.type, 20)?.toLowerCase().replace(/[^a-z ]/g, '') || null;
    out.push({ number, type });
  }
  return out;
}

export async function importAppfolioVendors(associationId: string, vendors: AppfolioVendor[]): Promise<VendorImportSummary> {
  const me = await requireStaff();
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) return { imported: 0, skipped: 0, errors: ['Your account is not linked to a company.'] };
  if (!Array.isArray(vendors) || vendors.length === 0) return { imported: 0, skipped: 0, errors: ['The file has no vendors.'] };
  if (typeof associationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(associationId)) {
    return { imported: 0, skipped: vendors.length, errors: ['Choose the association these vendors belong to.'] };
  }
  if (vendors.length > MAX_VENDORS) {
    return { imported: 0, skipped: vendors.length, errors: [`The file has ${vendors.length} vendors; import at most ${MAX_VENDORS} at a time.`] };
  }

  const db = (await createClient()) as any;
  // The association comes from the browser: it must be one this staffer manages
  // (can_manage_association also honors association-scoped managers).
  const { data: canManage, error: accessErr } = await db.rpc('can_manage_association', { p_association_id: associationId });
  if (accessErr || canManage !== true) {
    return { imported: 0, skipped: vendors.length, errors: [accessErr ? `Could not check the association: ${accessErr.message}` : 'You are not authorized to manage that association.'] };
  }
  try {
    // One vendor import per association at a time: the duplicate check and the inserts
    // must not interleave with another run (vendors have no unique key on name).
    return await withImportLock(db, associationId, 'appfolio_vendors', async () => {
      const errors: string[] = [];
      let skipped = 0;

      // Existing vendors of this association, for the duplicate check (paged: PostgREST caps a
      // read at 1000 rows). Also every email a vendor of this association already has (archived
      // ones too), so one email stays on one vendor of the association. The same company in
      // another association is a separate vendor record and may share its email.
      const existingNames = new Set<string>();
      const usedEmails = new Set<string>();
      let sharedEmailVendors = 0;
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from('vendors').select('id, name, emails, archived_at')
          .eq('association_id', associationId)
          .order('id').range(from, from + 999);
        if (error) return { imported: 0, skipped: vendors.length, errors: [`Could not check existing vendors: ${error.message}`] };
        for (const v of data ?? []) {
          if (typeof v.name === 'string' && !v.archived_at) existingNames.add(nameKey(v.name));
          // Both stored shapes (plain strings and legacy { email, type } objects).
          for (const e of vendorEmails(v.emails)) usedEmails.add(e.toLowerCase());
        }
        if (!data || data.length < 1000) break;
      }

      // Default GL accounts by number, this company's chart only. A number used by
      // more than one account (e.g. per-association charts) is left unmapped.
      // gl_accounts.number is an integer (CHECK 1000-9999): only four-digit numbers
      // are looked up; anything else ends up in unmatchedGl below.
      const glByNumber = new Map<string, string | null>();
      const wantedGl = [...new Set(
        vendors.map((v) => str(v?.gl_account_number, 30)).filter((n): n is string => !!n && /^\d{4}$/.test(n)),
      )];
      for (let i = 0; i < wantedGl.length; i += BATCH) {
        // Paged: per-association charts can return more than PostgREST's 1,000 rows, and a
        // missed row could make an ambiguous number look unique.
        const numbers = wantedGl.slice(i, i + BATCH).map(Number);
        const { rows: data, error } = await fetchAllRows<{ id: string; number: number; association_id: string | null }>(() => db
          .from('gl_accounts').select('id, number, association_id')
          .eq('portfolio_id', portfolioId).in('number', numbers)
          // Only accounts the vendor editor offers as a default: active expense-type accounts.
          .eq('active', true).in('account_type', ['expense', 'cost_of_goods_sold', 'other_expense'])
          .order('id'));
        if (error) return { imported: 0, skipped: vendors.length, errors: [`Could not load GL accounts: ${error}`] };
        const byNumber = new Map<string, Array<{ id: string; association_id: string | null }>>();
        for (const g of data ?? []) {
          const key = String(g.number);
          byNumber.set(key, [...(byNumber.get(key) ?? []), g]);
        }
        for (const [number, list] of byNumber) {
          const companyWide = list.filter((g) => !g.association_id);
          const pick = companyWide.length === 1 ? companyWide[0] : list.length === 1 ? list[0] : null;
          glByNumber.set(number, pick?.id ?? null);
        }
      }

      const prepared: Prepared[] = [];
      const unmatchedGl = new Set<string>();
      let expirationsKept = 0;
      let portalActive = 0;
      let withLastPayment = 0;
      let unknownPayment = 0;

      for (let i = 0; i < vendors.length; i++) {
        const v = vendors[i] as Partial<AppfolioVendor> | null;
        const line = str(v?.row, 10) ?? String(i + 2);
        const name = str(v?.name, 200);
        if (!name) { skipped++; errors.push(`Row ${line}: no vendor name.`); continue; }

        const allEmails = splitEmails(Array.isArray(v?.emails) ? v!.emails.filter((e) => typeof e === 'string').join(',') : '').slice(0, 10);
        // An email another vendor already holds stays in this vendor's notes, not its emails.
        const emails = allEmails.filter((e) => !usedEmails.has(e));
        const sharedEmails = allEmails.filter((e) => usedEmails.has(e));
        // A company vendor is identified by its company name only: its AppFolio Name is the
        // contact person, who may represent several companies.
        const keys = [nameKey(name), v?.company_name ? '' : nameKey(str(v?.appfolio_name, 200) ?? '')].filter(Boolean);
        if (keys.some((k) => existingNames.has(k))) {
          skipped++; errors.push(`Row ${line} (${name}): skipped — a vendor with this name already exists.`); continue;
        }
        // A shared email alone doesn't make two vendors the same: one contact can represent
        // several companies. Vendors are matched by name (above).
        if (sharedEmails.length) sharedEmailVendors++;

        const glNumber = str(v?.gl_account_number, 30);
        const glId = glNumber ? glByNumber.get(glNumber) ?? null : null;
        if (glNumber && !glId) unmatchedGl.add(glNumber);

        const paymentType = PAYMENT_TYPES.find((p) => p === v?.payment_type);
        if (!paymentType && (v?.payment_type || str(v?.payment_type_raw, 40))) unknownPayment++;

        const state = str(v?.address_state, 20)?.toUpperCase() ?? null;
        const contact = str(v?.contact_name, 200);
        const tags = str(v?.tags, 500);
        const notes = [
          contact && `Contact: ${contact}`,
          tags && `Tags from previous system: ${tags}`,
          sharedEmails.length ? `Also uses ${sharedEmails.join(', ')} (shared with another vendor)` : null,
        ].filter(Boolean).join('\n') || null;

        const expirations = Object.fromEntries(
          EXPIRATIONS.map((k) => [k, parseAppfolioDate(typeof v?.[k] === 'string' ? (v[k] as string) : null)]),
        ) as Record<(typeof EXPIRATIONS)[number], string | null>;
        if (Object.values(expirations).some(Boolean)) expirationsKept++;
        if (v?.portal_activated === true) portalActive++;
        if (str(v?.last_payment_date, 20)) withLastPayment++;

        prepared.push({
          line,
          name,
          insert: {
            portfolio_id: portfolioId,
            association_id: associationId,
            created_by: me.auth_user_id ?? null,
            name,
            phone_numbers: phonesOf(v?.phones),
            emails,
            address_street: str(v?.address_street, 200),
            address_city: str(v?.address_city, 100),
            address_state: state && /^[A-Z]{2}$/.test(state) ? state : null,
            address_zip: str(v?.address_zip, 10),
            default_gl_account_id: glId,
            payment_type: paymentType ?? 'check',
            send_1099: v?.send_1099 === true,
            notes,
            ...expirations,
          },
        });
        // Later rows of the same file count as duplicates too.
        keys.forEach((k) => existingNames.add(k));
        emails.forEach((e) => usedEmails.add(e));
      }

      let imported = 0;
      const insertOne = async (p: Prepared) => {
        const { error } = await db.from('vendors').insert(p.insert);
        if (!error) { imported++; return; }
        // A GL account this role may not use blocks the whole row; keep the vendor without it.
        if (p.insert.default_gl_account_id && /GL account/i.test(error.message)) {
          const { error: again } = await db.from('vendors').insert({ ...p.insert, default_gl_account_id: null });
          if (!again) {
            imported++;
            errors.push(`Row ${p.line} (${p.name}): imported without its default GL account (${error.message}).`);
            return;
          }
        }
        skipped++;
        errors.push(`Row ${p.line} (${p.name}): ${error.message}`);
      };

      for (let i = 0; i < prepared.length; i += BATCH) {
        const batch = prepared.slice(i, i + BATCH);
        const { error } = await db.from('vendors').insert(batch.map((p) => p.insert));
        if (!error) { imported += batch.length; continue; }
        // One bad row fails the whole batch: retry row by row to import the rest.
        for (const p of batch) await insertOne(p);
      }

      // What the export has that the import does not carry over.
      const notImported: string[] = [];
      if (unmatchedGl.size) {
        notImported.push(`Default GL account left blank for GL number(s) not found among the active expense accounts in your chart: ${[...unmatchedGl].slice(0, 20).join(', ')}${unmatchedGl.size > 20 ? '…' : ''}.`);
      }
      if (sharedEmailVendors) notImported.push(`${sharedEmailVendors} vendor(s) share an email with another vendor of this association; it was kept on the first one and noted on the others.`);
      if (unknownPayment) notImported.push(`${unknownPayment} vendor(s) had a payment type that isn't supported; they were set to Check.`);
      if (portalActive) notImported.push(`Vendor portal access was not carried over for ${portalActive} vendor(s): invite them from the vendor page.`);
      if (withLastPayment) notImported.push(`Last payment dates were not imported (${withLastPayment} vendor(s)); payment history comes from bills.`);
      if (expirationsKept) notImported.push(`Insurance, license and contract expiration dates were imported for ${expirationsKept} vendor(s).`);

      if (imported) revalidatePath('/vendors');
      const all = [...notImported, ...errors];
      return { imported, skipped, errors: all.length ? all : undefined };
    });
  } catch (e) {
    return { imported: 0, skipped: vendors.length, errors: [e instanceof Error ? e.message : 'The import failed. Try again.'] };
  }
}
