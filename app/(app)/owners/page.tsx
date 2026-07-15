import Link from 'next/link';
import { Plus } from 'lucide-react';

import { ExportActions, type ExportTable } from '@/components/export/export-actions';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

type OwnerRow = {
  id: string;
  name: string;
  lastInitial: string;
  email: string | null;
  phone: string | null;
  preferredComm: string;
  portalActivated: boolean;
  portalLastLogin: string | null;
  electronicConsent: boolean;
  associationName: string | null;
  associationAddress: string | null;
  unitNumber: string | null;
  occupancyType: string | null;
  balance: number;
};

function formatName(first?: string | null, last?: string | null, full?: string | null) {
  if (last && first) return `${last}, ${first}`;
  return full ?? ([last, first].filter(Boolean).join(', ') || 'Unknown owner');
}

function firstPhone(phoneNumbers: unknown, phone: string | null) {
  if (Array.isArray(phoneNumbers) && phoneNumbers.length > 0) {
    const first = phoneNumbers[0] as { number?: string; value?: string };
    return first.number ?? first.value ?? phone;
  }
  return phone;
}

function assocAddress(association: any) {
  if (!association) return null;
  return [association.address, [association.city, association.state].filter(Boolean).join(', '), association.zip]
    .filter(Boolean)
    .join(' ');
}

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; letter?: string; q?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const view = sp.view === 'directory' || sp.view === 'tenants' ? sp.view : 'homeowners';
  const letter = sp.letter ?? 'all';
  const q = (sp.q ?? '').trim().toLowerCase();

  const supabase = await createClient();

  const [{ data: owners }, { data: occupancies }, { data: tenants }] = await Promise.all([
    (supabase as any)
      .from('owners')
      .select('id, full_name, first_name, last_name, email, phone, phone_numbers, preferred_comm, portal_activated, portal_login_last_at, electronic_consent, archived_at')
      .is('archived_at', null)
      .order('last_name', { ascending: true }),
    (supabase as any)
      .from('occupancies')
      .select(`
        id,
        owner_id,
        unit_id,
        occupancy_type,
        status,
        units(unit_number, buildings(associations(id, name, address, city, state, zip)))
      `)
      .eq('status', 'current'),
    (supabase as any)
      .from('tenants')
      .select('id, first_name, last_name, email, phone, lease_start, lease_end, status, unit_id, owner_id, units(unit_number, buildings(associations(name)))')
      .is('archived_at', null)
      .eq('status', 'active')
      .order('last_name'),
  ]);

  const occupancyByOwner = new Map<string, any>();
  for (const occupancy of occupancies ?? []) {
    if (!occupancyByOwner.has((occupancy as any).owner_id)) {
      occupancyByOwner.set((occupancy as any).owner_id, occupancy);
    }
  }

  // Outstanding balance per owner (for the at-a-glance delinquency chip)
  const occUnitIds = [...new Set((occupancies ?? []).map((o: any) => o.unit_id).filter(Boolean))];
  const balanceByUnit = new Map<string, number>();
  if (occUnitIds.length > 0) {
    const { data: balances } = await (supabase as any)
      .from('unit_balances').select('unit_id, balance').in('unit_id', occUnitIds);
    for (const b of balances ?? []) balanceByUnit.set(b.unit_id, Number(b.balance ?? 0));
  }
  const balanceByOwner = new Map<string, number>();
  for (const occupancy of occupancies ?? []) {
    const o = occupancy as any;
    if (!o.owner_id || !o.unit_id) continue;
    balanceByOwner.set(o.owner_id, (balanceByOwner.get(o.owner_id) ?? 0) + (balanceByUnit.get(o.unit_id) ?? 0));
  }

  let rows: OwnerRow[] = (owners ?? []).map((owner: any) => {
    const occupancy = occupancyByOwner.get(owner.id);
    const association = occupancy?.units?.buildings?.associations;
    return {
      id: owner.id,
      name: formatName(owner.first_name, owner.last_name, owner.full_name),
      lastInitial: (owner.last_name?.[0] ?? owner.full_name?.[0] ?? '').toUpperCase(),
      email: owner.email,
      phone: firstPhone(owner.phone_numbers, owner.phone),
      preferredComm: owner.preferred_comm ?? 'email',
      portalActivated: Boolean(owner.portal_activated),
      portalLastLogin: owner.portal_login_last_at,
      electronicConsent: Boolean(owner.electronic_consent),
      associationName: association?.name ?? null,
      associationAddress: assocAddress(association),
      unitNumber: occupancy?.units?.unit_number ?? null,
      occupancyType: occupancy?.occupancy_type ?? null,
      balance: balanceByOwner.get(owner.id) ?? 0,
    };
  });

  if (view === 'homeowners') rows = rows.filter((row) => row.occupancyType === 'owner');
  if (letter !== 'all') rows = rows.filter((row) => row.lastInitial === letter);
  if (q) {
    rows = rows.filter((row) =>
      [row.name, row.email, row.phone, row.associationName, row.unitNumber].some((value) =>
        value?.toLowerCase().includes(q),
      ),
    );
  }

  const baseRows = (owners ?? []) as any[];
  const portalActive = baseRows.filter((owner) => owner.portal_activated).length;
  const missingEmail = baseRows.filter((owner) => !owner.email).length;
  const availableLetters = new Set(
    baseRows.map((owner) => (owner.last_name?.[0] ?? owner.full_name?.[0] ?? '').toUpperCase()).filter(Boolean),
  );

  // ── Occupancy mix: owner-occupied vs tenant-occupied units ──
  const tenantRows = (tenants ?? []) as any[];
  const tenantUnitIds = new Set(tenantRows.map((t) => t.unit_id));
  const occupiedUnitIds = new Set((occupancies ?? []).filter((o: any) => o.occupancy_type === 'owner').map((o: any) => o.unit_id));
  for (const unitId of tenantUnitIds) occupiedUnitIds.add(unitId);
  const tenantOccupied = tenantUnitIds.size;
  const ownerOccupied = occupiedUnitIds.size - tenantOccupied;
  const occupancyPct = occupiedUnitIds.size > 0 ? Math.round((ownerOccupied / occupiedUnitIds.size) * 100) : null;

  // ── Export (mirrors the active view's on-screen list, same filters) ──
  const companyName = me.portfolio?.company_name ?? 'Management company';
  const exportStamp = new Date().toISOString().slice(0, 10);
  const exportTable: ExportTable =
    view === 'tenants'
      ? {
          title: 'Tenants',
          columns: [
            { header: 'Tenant' },
            { header: 'Email' },
            { header: 'Phone' },
            { header: 'Association' },
            { header: 'Unit' },
            { header: 'Lease Start' },
            { header: 'Lease End' },
          ],
          rows: tenantRows
            .filter((t) => !q || [`${t.first_name} ${t.last_name}`, t.email, t.phone, t.units?.unit_number].some((v: any) => v?.toLowerCase?.().includes(q)))
            .map((t) => [
              `${t.last_name}, ${t.first_name}`,
              t.email ?? 'No email',
              t.phone ?? 'No phone',
              t.units?.buildings?.associations?.name ?? '—',
              t.units?.unit_number ?? '—',
              t.lease_start ? date(t.lease_start) : '—',
              t.lease_end ? date(t.lease_end) : '—',
            ]),
        }
      : {
          title: view === 'directory' ? 'Owner Directory' : 'Owners',
          columns: [
            { header: 'Name' },
            { header: 'Email' },
            { header: 'Phone' },
            { header: 'Association' },
            { header: 'Unit' },
            { header: 'Portal' },
            { header: 'Balance Due', align: 'right' },
          ],
          rows: rows.map((row) => [
            row.name,
            row.email ?? 'No email on file',
            row.phone ?? 'No phone',
            row.associationName ?? 'No current association',
            row.unitNumber ?? '—',
            row.portalActivated ? 'Active' : 'Not active',
            row.balance > 0 ? money(row.balance) : '—',
          ]),
        };

  const tabs = [
    { label: 'Owners', href: '/owners', active: view === 'homeowners' },
    { label: 'Directory', href: '/owners?view=directory', active: view === 'directory' },
    { label: 'Tenants', href: '/owners?view=tenants', active: view === 'tenants' },
    { label: 'Vendors', href: '/vendors', active: false },
  ];

  const buildLetterHref = (item: string) => {
    const params = new URLSearchParams();
    if (view !== 'homeowners') params.set('view', view);
    if (q) params.set('q', q);
    if (item !== 'all') params.set('letter', item);
    const query = params.toString();
    return `/owners${query ? `?${query}` : ''}`;
  };

  return (
    <DataWorkspace
      title={view === 'tenants' ? 'Tenants' : view === 'directory' ? 'Owner Directory' : 'Owners'}
      description="Search owners, confirm current unit links, and launch portal, packet, ACH, and agreement workflows."
      actions={
        <>
          <ExportActions
            documentTitle="Owners Directory"
            companyName={companyName}
            filename={`owners-${view}-${exportStamp}`}
            tables={[exportTable]}
          />
          {view === 'tenants' && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler returns a CSV download, not a page
            <a href="/owners/leases/export">
              <Button variant="secondary">Export leases (CSV)</Button>
            </a>
          )}
          <Link href="/owners/forms">
            <Button variant="secondary">Send owner form</Button>
          </Link>
          <Link href="/owners/new">
            <Button><Plus className="h-4 w-4" /> New owner</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab.active ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <MetricStrip
          metrics={[
            { label: 'Owner-occupied units', value: ownerOccupied, sublabel: occupancyPct !== null ? `${occupancyPct}% of occupied units` : 'No occupancy links yet' },
            { label: 'Tenant-occupied units', value: tenantOccupied, sublabel: occupancyPct !== null ? `${100 - occupancyPct}% of occupied units` : 'No tenants on file' },
            { label: 'People records', value: baseRows.length, sublabel: `${portalActive} portal active` },
            { label: 'Missing email', value: missingEmail },
          ]}
        />

        <FilterBar action="/owners" searchDefault={sp.q ?? ''} searchPlaceholder="Search owner, association, unit, email, or phone">
          {view !== 'homeowners' && <input type="hidden" name="view" value={view} />}
          <FilterSelect label="Letter" name="letter" defaultValue={letter}>
            <option value="all">All</option>
            {LETTERS.map((item) => (
              <option key={item} value={item} disabled={!availableLetters.has(item)}>
                {item}
              </option>
            ))}
          </FilterSelect>
        </FilterBar>

        <div className="flex flex-wrap gap-1 text-sm">
          {LETTERS.map((item) => (
            <Link
              key={item}
              href={buildLetterHref(item)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${letter === item ? 'bg-gray-950 text-white' : availableLetters.has(item) ? 'text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-100' : 'pointer-events-none text-gray-300'}`}
            >
              {item}
            </Link>
          ))}
          <Link
            href={buildLetterHref('all')}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${letter === 'all' ? 'bg-gray-950 text-white' : 'text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-100'}`}
          >
            All
          </Link>
        </div>

        {view === 'tenants' ? (
          <Table>
            <THead>
              <TR>
                <TH>Tenant</TH>
                <TH>Contact</TH>
                <TH>Association / Unit</TH>
                <TH>Lease Start</TH>
                <TH>Lease End</TH>
                <TH>Owner</TH>
              </TR>
            </THead>
            <tbody>
              {tenantRows.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-10 text-center text-gray-500">
                    No active tenants on file. Add tenants from the owner&apos;s detail page (Occupancy &amp; tenants section).
                  </TD>
                </TR>
              ) : (
                tenantRows
                  .filter((t) => !q || [`${t.first_name} ${t.last_name}`, t.email, t.phone, t.units?.unit_number].some((v: any) => v?.toLowerCase?.().includes(q)))
                  .map((t) => (
                    <TR key={t.id} className="hover:bg-gray-50">
                      <TD className="font-medium text-gray-900">{t.last_name}, {t.first_name}</TD>
                      <TD>
                        <div className="text-gray-900">{t.email ?? 'No email'}</div>
                        <div className="mt-1 text-xs text-gray-500">{t.phone ?? 'No phone'}</div>
                      </TD>
                      <TD>
                        <div className="font-medium text-gray-900">{t.units?.buildings?.associations?.name ?? '—'}</div>
                        <div className="mt-1 text-xs text-gray-500">Unit {t.units?.unit_number ?? '—'}</div>
                      </TD>
                      <TD className="tabular-nums">{t.lease_start ? date(t.lease_start) : '—'}</TD>
                      <TD className="tabular-nums">{t.lease_end ? date(t.lease_end) : '—'}</TD>
                      <TD>
                        {t.owner_id
                          ? <Link href={`/owners/${t.owner_id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">View owner</Link>
                          : '—'}
                      </TD>
                    </TR>
                  ))
              )}
            </tbody>
          </Table>
        ) : view === 'directory' ? (
          // Compact contact-card grid for quick lookup — distinct from the
          // operational Owners table (no workflow buttons, print-friendly).
          rows.length === 0 ? (
            <div className="rounded-2xl border border-gray-200/70 bg-white py-10 text-center text-sm text-gray-500 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              No owner records match this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <Link
                  key={row.id}
                  href={`/owners/${row.id}`}
                  className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-gray-300 hover:shadow-[0_1px_3px_rgba(16,24,40,0.08)]"
                >
                  <div className="text-sm font-semibold text-gray-950">{row.name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {row.associationName ?? 'No current association'}
                    {row.unitNumber ? ` · Unit ${row.unitNumber}` : ''}
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="text-gray-700">{row.email ?? 'No email on file'}</div>
                    <div className="text-gray-500">{row.phone ?? 'No phone'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Contact</TH>
              <TH>Association / Unit</TH>
              <TH>Portal</TH>
              <TH>Workflows</TH>
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-10 text-center text-gray-500">No owner records match this filter.</TD>
              </TR>
            ) : (
              rows.map((row) => (
                <TR key={row.id} className="hover:bg-gray-50">
                  <TD>
                    <div className="flex items-center gap-2">
                      <Link href={`/owners/${row.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{row.name}</Link>
                      {row.balance > 0 && <StatusChip tone="danger">{money(row.balance)} due</StatusChip>}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{row.preferredComm.replace(/_/g, ' ')} preferred</div>
                  </TD>
                  <TD>
                    <div className="text-gray-900">{row.email ?? 'No email on file'}</div>
                    <div className="mt-1 text-xs text-gray-500">{row.phone ?? 'No phone'}</div>
                  </TD>
                  <TD>
                    <div className="font-medium text-gray-900">{row.associationName ?? 'No current association'}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {row.unitNumber ? `Unit ${row.unitNumber}` : 'No unit link'}
                      {row.associationAddress ? ` - ${row.associationAddress}` : ''}
                    </div>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <StatusChip tone={row.portalActivated ? 'success' : 'warning'}>
                        {row.portalActivated ? 'Active' : 'Not active'}
                      </StatusChip>
                      {row.electronicConsent && <StatusChip tone="info">E-consent</StatusChip>}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">Last login {date(row.portalLastLogin)}</div>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link href={`/owners/activations?owner=${row.id}`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-50">Activate</Link>
                      <Link href={`/owners/packets?owner=${row.id}`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-50">Packet</Link>
                      <Link href={`/owners/ach?owner=${row.id}`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-50">ACH</Link>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
