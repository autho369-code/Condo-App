import Link from 'next/link';
import { Plus } from 'lucide-react';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

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
  await requireStaff();
  const sp = await searchParams;
  const view = sp.view === 'directory' || sp.view === 'tenants' ? sp.view : 'homeowners';
  const letter = sp.letter ?? 'all';
  const q = (sp.q ?? '').trim().toLowerCase();

  const supabase = await createClient();

  const [{ data: owners }, { data: occupancies }] = await Promise.all([
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
        occupancy_type,
        status,
        units(unit_number, buildings(associations(id, name, address, city, state, zip)))
      `)
      .eq('status', 'current'),
  ]);

  const occupancyByOwner = new Map<string, any>();
  for (const occupancy of occupancies ?? []) {
    if (!occupancyByOwner.has((occupancy as any).owner_id)) {
      occupancyByOwner.set((occupancy as any).owner_id, occupancy);
    }
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
    };
  });

  if (view === 'homeowners') rows = rows.filter((row) => row.occupancyType === 'owner');
  if (view === 'tenants') rows = rows.filter((row) => row.occupancyType === 'tenant');
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
  const currentOwnerLinks = (occupancies ?? []).filter((occupancy: any) => occupancy.occupancy_type === 'owner').length;
  const availableLetters = new Set(
    baseRows.map((owner) => (owner.last_name?.[0] ?? owner.full_name?.[0] ?? '').toUpperCase()).filter(Boolean),
  );

  const tabs = [
    { label: 'Owners', href: '/owners', active: view === 'homeowners' },
    { label: 'Owners', href: '/owners?view=directory', active: view === 'directory' },
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
            { label: 'People records', value: baseRows.length },
            { label: 'Current owner links', value: currentOwnerLinks },
            { label: 'Portal active', value: portalActive },
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
                    <Link href={`/owners/${row.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{row.name}</Link>
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
      </div>
    </DataWorkspace>
  );
}
