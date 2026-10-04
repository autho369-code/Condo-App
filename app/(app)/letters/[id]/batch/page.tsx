import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Users } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { BatchLetters, type BatchLetter } from '@/components/letters/batch-letters';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { buildMergeValues, mergeTemplate, unfilledFields, type MergeOwner } from '@/lib/letters/merge';
import { todayInZone } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ownership = { owner_id: string; is_primary: boolean | null; start_date: string | null; end_date: string | null; owners: MergeOwner & { id: string } | null };
type UnitRow = { id: string; unit_number: string | null; unit_owners: Ownership[] };

function addressLines(o: MergeOwner): string[] {
  if (o.mailing_address?.trim()) return o.mailing_address.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cityLine = [o.address_city, [o.address_state, o.address_zip].filter(Boolean).join(' ')].filter((p) => p && p.trim()).join(', ');
  return [o.address_street ?? '', cityLine].map((l) => l.trim()).filter(Boolean);
}

export default async function BatchLettersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ association?: string; per?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const associationId = sp.association && UUID.test(sp.association) ? sp.association : '';
  const perOwner = sp.per === 'owner';

  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: template }, { data: associations }] = await Promise.all([
    db.from('document_templates').select('id, name, subject, body, active').eq('id', id).is('archived_at', null).maybeSingle(),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);
  if (!template) notFound();

  let letters: BatchLetter[] = [];
  let missingFields: string[] = [];
  let loadError: string | null = null;
  let association: any = null;

  if (associationId) {
    const [{ data: assoc }, { data: president }, units] = await Promise.all([
      db.from('associations')
        .select('id, name, address, address_line_2, city, state, zip, maintenance_phone, payment_instructions, late_fee_amount_override, site_manager, timezone')
        .eq('id', associationId).is('archived_at', null).maybeSingle(),
      db.from('board_members').select('full_name').eq('association_id', associationId).eq('active', true).eq('role', 'president').limit(1).maybeSingle(),
      fetchAllRows<UnitRow>(() => db.from('units')
        .select('id, unit_number, buildings!inner(association_id), unit_owners(owner_id, is_primary, start_date, end_date, owners(id, full_name, email, phone, mailing_address, address_street, address_city, address_state, address_zip, archived_at))')
        .eq('buildings.association_id', associationId)
        .is('archived_at', null)
        .order('unit_number')
        .order('id')),
    ]);
    association = assoc;
    if (!assoc) loadError = 'That association is unavailable or outside your access.';
    else if (units.error) loadError = `Could not load homeowners: ${units.error}`;
    else {
      const zone = assoc.timezone || undefined;
      const today = todayInZone(zone);
      // A transfer ends the seller's ownership on the day the buyer's starts,
      // so an ownership ending today is no longer current.
      const isCurrent = (o: Ownership) =>
        !!o.owners && !(o.owners as any).archived_at
        && (!o.start_date || o.start_date <= today)
        && (!o.end_date || o.end_date > today);

      // Recipients: one per unit (its primary current owner) or one per owner
      // (an owner of several units gets a single letter listing them).
      const recipients = new Map<string, { owner: MergeOwner & { id: string }; units: string[] }>();
      for (const u of units.rows) {
        // Primary first, then the most recent start: a deterministic pick.
        const current = (u.unit_owners ?? []).filter(isCurrent).sort((x, y) =>
          Number(!!y.is_primary) - Number(!!x.is_primary) || (y.start_date ?? '').localeCompare(x.start_date ?? ''));
        if (current.length === 0) continue;
        const chosen = perOwner ? current : [current[0]];
        for (const o of chosen) {
          const key = perOwner ? o.owner_id : `${u.id}:${o.owner_id}`;
          const entry = recipients.get(key) ?? { owner: o.owners!, units: [] };
          if (u.unit_number) entry.units.push(u.unit_number);
          recipients.set(key, entry);
        }
      }

      const now = new Date();
      const missing = new Set<string>();
      letters = [...recipients.entries()]
        .sort(([, a], [, b]) => (a.units[0] ?? '').localeCompare(b.units[0] ?? '', undefined, { numeric: true }) || (a.owner.full_name ?? '').localeCompare(b.owner.full_name ?? ''))
        .map(([key, r]) => {
          const values = buildMergeValues({ association: assoc, boardPresidentName: president?.full_name, owner: r.owner, unitNumbers: r.units, now, timeZone: zone });
          for (const f of unfilledFields(`${template.subject ?? ''} ${template.body ?? ''}`, values)) missing.add(f);
          return {
            key,
            recipient: r.owner.full_name || 'Homeowner',
            addressLines: addressLines(r.owner),
            unitLabel: r.units.length ? `Unit ${r.units.join(', ')}` : '',
            subject: mergeTemplate(template.subject ?? '', values, { html: false }).replace(/[\r\n]+/g, ' ').trim(),
            bodyUnsafe: mergeTemplate(template.body ?? '', values, { html: true }),
          };
        });
      missingFields = [...missing];
    }
  }

  const noAddress = letters.filter((l) => l.addressLines.length === 0).length;

  return (
    <DataWorkspace
      title={`Batch letters: ${template.name}`}
      description="Merge this template for every current homeowner in an association, review the letters, and print them in one run."
      actions={<>
        <Link href={`/letters/${id}/preview`}><Button variant="secondary">Single letter</Button></Link>
        <Link href="/letters"><Button variant="secondary">All templates</Button></Link>
      </>}
    >
      <div className="space-y-6">
        {!template.active && <Alert tone="warning">This template is inactive. You can still print from it.</Alert>}

        <FilterBar action={`/letters/${id}/batch`} search={false}>
          <FilterSelect label="Association" name="association" defaultValue={associationId}>
            <option value="">Select an association</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Recipients" name="per" defaultValue={perOwner ? 'owner' : 'unit'}>
            <option value="unit">One per unit (primary owner)</option>
            <option value="owner">Every current owner</option>
          </FilterSelect>
        </FilterBar>

        {loadError && <Alert tone="danger" title="Could not prepare letters:">{loadError}</Alert>}

        {associationId && association && !loadError && (
          <>
            {missingFields.length > 0 && (
              <Alert tone="warning" title="Some merge fields have no value:">
                {missingFields.map((f) => `{{${f}}}`).join(', ')} will print as written. Fill them in on the association or homeowner record, or edit the template.
              </Alert>
            )}
            {noAddress > 0 && (
              <Alert tone="warning">{noAddress} homeowner{noAddress === 1 ? ' has' : 's have'} no mailing address on file.</Alert>
            )}
            {letters.length > 0 ? (
              <BatchLetters letters={letters} title={`${template.name} · ${association.name}`} />
            ) : (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState icon={Users} title="No current homeowners" description="This association has no units with a current owner of record." />
              </div>
            )}
          </>
        )}

        {!associationId && (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState icon={Users} title="Choose an association" description="Every current homeowner gets a letter with their own name, unit and address merged in." />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
