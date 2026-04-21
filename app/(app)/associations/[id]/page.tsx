import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'association',  label: 'Association',          href: '' },
  { key: 'units',        label: 'Units',                href: '/units' },
  { key: 'unit_groups',  label: 'Unit Groups',          href: '/unit-groups' },
  { key: 'board',        label: 'Board of Directors',   href: '/board' },
  { key: 'approvals',    label: 'Approvals',            href: '/approvals' },
  { key: 'committees',   label: 'Committees',           href: '/committees' },
  { key: 'arch',         label: 'Architectural Reviews', href: '/architectural-reviews' },
  { key: 'badges',       label: 'Badges',               href: '/badges' },
  { key: 'amenities',    label: 'Amenities',            href: '/amenities' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function yn(v: any) { return v ? 'Yes' : 'No'; }
function dash(v: any, fallback = '—') { return v == null || v === '' ? fallback : v; }

export default async function AssociationDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: assoc },
    { data: buildings },
    { data: upcomingEvents },
    { data: units },
    { data: mgmtFees },
    { data: additionalFees },
    { data: bankAccounts },
    { data: fixedAssets },
    { data: keys },
    { data: violationSteps },
    { data: notes },
    { data: attachments },
    { data: propertyGroup },
  ] = await Promise.all([
    supabase.from('associations').select('*').eq('id', id).maybeSingle(),
    // Physical properties under this association. The primary building supplies
    // address / maintenance info at the top of the page; the rest appear in
    // the Properties section.
    supabase.from('buildings')
      .select(`
        id, name, address, address_line_2, city, state, zip, county,
        property_type, year_built, description, site_manager, site_manager_phone,
        amenities, maintenance_limit, insurance_expiration, home_warranty_covered,
        disable_online_maintenance_requests, unit_entry_pre_authorized,
        maintenance_notes, online_maintenance_request_instructions,
        lockbox_id, is_primary, created_at
      `)
      .eq('association_id', id)
      .is('archived_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at'),
    supabase.from('calendar_events')
      .select('id, title, event_type, start_datetime, all_day, location')
      .eq('association_id', id).is('archived_at', null)
      .gte('start_datetime', new Date().toISOString())
      .order('start_datetime').limit(5),
    supabase.from('occupancies')
      .select(`
        id, unit_id, share_pct, dues_amount, occupancy_type, status,
        units(unit_number),
        owners:owner_id(full_name, first_name, last_name)
      `)
      .eq('association_id', id)
      .eq('status', 'current')
      .order('unit_id'),
    supabase.from('management_fee_policies')
      .select('*').eq('association_id', id)
      .order('effective_from', { ascending: false }),
    supabase.from('association_additional_fees')
      .select('*, gl_accounts(number, name)').eq('association_id', id),
    supabase.from('bank_accounts')
      .select('id, name, bank_name, account_type, purpose, payments_enabled, gl_accounts(number, name)')
      .eq('association_id', id).is('archived_at', null),
    supabase.from('fixed_assets')
      .select('id, name, asset_type, purchase_date, purchase_price')
      .eq('association_id', id).is('archived_at', null).limit(10),
    supabase.from('association_keys')
      .select('*').eq('association_id', id).is('archived_at', null),
    supabase.from('violation_followup_steps')
      .select('*, document_templates(name)').eq('association_id', id).is('archived_at', null).order('step_order'),
    supabase.from('association_notes')
      .select('*, profiles:created_by(full_name)').eq('association_id', id).is('archived_at', null).order('created_at', { ascending: false }).limit(20),
    supabase.from('association_attachments')
      .select('id, folder, file_name, byte_size, created_at, shared_with_owner, profiles:uploaded_by(full_name)')
      .eq('association_id', id).is('archived_at', null).order('created_at', { ascending: false }),
    supabase.from('associations').select('id, property_group_id, property_groups(name)').eq('id', id).maybeSingle(),
  ]);
  if (!assoc) notFound();

  // Physical-asset fields now read from the primary building, not the association
  // itself. See PROJECT_HANDOFF.md §0.
  const buildingsList = (buildings ?? []) as any[];
  const primaryBuilding: any = buildingsList.find((b) => b.is_primary) ?? buildingsList[0] ?? null;

  const totalUnits = (units ?? []).length;
  const rentedUnits = (units ?? []).filter((u: any) => u.occupancy_type === 'tenant').length;
  const ownerOccupied = totalUnits > 0 ? Math.round(((totalUnits - rentedUnits) / totalUnits) * 100) : 0;

  // Attachments grouped by folder
  const folders = new Map<string, any[]>();
  const unfiled: any[] = [];
  for (const a of (attachments ?? [])) {
    if (a.folder) {
      if (!folders.has(a.folder)) folders.set(a.folder, []);
      folders.get(a.folder)!.push(a);
    } else {
      unfiled.push(a);
    }
  }

  // Audit log — best-effort: recent created_at across management fee policies, bank accounts
  const auditEntries: Array<{ date: string; text: string }> = [];
  for (const p of (mgmtFees ?? []).slice(0, 4)) {
    auditEntries.push({
      date: p.created_at,
      text: `Created Management Fee Policy starting on ${date(p.effective_from)}, ${money(p.amount)} ${p.fee_type?.replace(/_/g, ' ') ?? ''}`,
    });
  }
  for (const b of (bankAccounts ?? [])) {
    auditEntries.push({
      date: (b as any).created_at ?? new Date().toISOString(),
      text: `Added ${b.name}${b.bank_name ? ' - ' + b.bank_name : ''}${(b as any).gl_accounts ? ` with bank account ${(b as any).gl_accounts.number}: ${(b as any).gl_accounts.name}` : ''}`,
    });
  }
  auditEntries.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-4 pb-20">

          {/* ============== TOP TABS ============== */}
          <nav className="flex gap-6 border-b border-gray-200 text-sm">
            {TABS.map((t) => {
              const href = t.key === 'association' ? `/associations/${id}` : `/associations/${id}${t.href}`;
              const active = t.key === 'association';
              return (
                <Link key={t.key} href={href}
                  className={`border-b-2 px-1 pb-2 transition ${active ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>

          {/* ============== HEADER CARD ============== */}
          {/* Address / Property Type come from the primary BUILDING (physical asset),
              not the Association. If no building exists yet, prompt to add one. */}
          <Section>
            <div className="flex items-start gap-5 px-5 py-4">
              <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded bg-gray-100 text-4xl">🏢</div>
              <div className="flex-1">
                <h1 className="mb-2 text-xl font-semibold text-gray-900">{assoc.name}</h1>
                {primaryBuilding ? (
                  <>
                    <Row label="Property Type" value={(primaryBuilding.property_type ?? 'hoa').replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase())} />
                    <Row label="Address" value={
                      <>
                        {primaryBuilding.address}
                        {primaryBuilding.address_line_2 && <div>{primaryBuilding.address_line_2}</div>}
                        <div>{[primaryBuilding.city, primaryBuilding.state].filter(Boolean).join(', ')} {primaryBuilding.zip}</div>
                      </>
                    } />
                    <Row label="County" value={dash(primaryBuilding.county, 'Cook County')} />
                  </>
                ) : (
                  <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No physical property yet.{' '}
                    <Link href={`/buildings/new?association=${id}`} className="font-semibold text-blue-700 hover:underline">
                      Add the building →
                    </Link>
                  </div>
                )}
              </div>
              <Link href={`/associations/${id}/edit`} className="text-sm text-blue-700 hover:underline">Edit</Link>
            </div>
          </Section>

          {/* ============== UPCOMING ACTIVITIES ============== */}
          <SectionHeader title="Upcoming Activities" right={<Link href={`/calendar/new?assoc=${id}`} className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">+ Add Activity</Link>} />
          <Section>
            {(upcomingEvents ?? []).length === 0 ? (
              <p className="px-5 py-4 text-center text-sm text-gray-500">There are no activities at this time.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(upcomingEvents ?? []).map((e: any) => (
                  <li key={e.id} className="flex items-center justify-between px-5 py-2 text-sm">
                    <div>
                      <span className="font-medium">{e.title}</span>
                      <span className="ml-2 text-xs text-gray-500">{new Date(e.start_datetime).toLocaleString('en-US')}</span>
                    </div>
                    <span className="text-xs uppercase text-gray-500">{e.event_type?.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ============== ASSOCIATION INFORMATION ============== */}
          <SectionHeader title="Association Information" right={<EditLink id={id} />} />
          <Section>
            <dl className="divide-y divide-gray-100 text-sm">
              <Row label="Description" value={dash(assoc.description)} />
              {/* Site Manager + Year Built are physical-asset fields → read from primary building */}
              <Row label="Site Manager" value={dash(primaryBuilding?.site_manager)} />
              <Row label="Year Built" value={dash(primaryBuilding?.year_built)} />
              <Row label="Assoc Payment Frequency" value={
                <>
                  {(assoc.payment_frequency ?? 'Monthly').replace(/^./, (c: string) => c.toUpperCase())}
                  {assoc.owner_can_override_frequency && <span className="ml-2 text-xs text-gray-500">(Owners can override)</span>}
                </>
              } />
              <Row label="Owners Start Date"  value={dash(date(assoc.management_start_date))} />
              <Row label="Owners End Date"    value={dash(date(assoc.management_end_date))} />
              <Row label="Owners End Reason"  value={dash(assoc.management_end_reason)} />
              <Row label="NSF Fee" value={assoc.nsf_fee_amount_override != null ? money(assoc.nsf_fee_amount_override) : '—'} />
              <Row label="Hide Calendar In Online Portal" value={yn(assoc.hide_calendar_in_portal)} />
              <Row label="Disable Contacts Info Editing In Online Portal" value={yn(assoc.disable_contacts_editing_in_portal)} />
              <Row label="Disable Tenants Info Editing In Online Portal"  value={yn(assoc.disable_renter_editing_in_portal)} />
              <Row label="Tenants Check Fee Coverage Enabled"             value={yn(assoc.residents_check_fee_coverage_enabled)} />
            </dl>
          </Section>

          {/* ============== AMENITIES ============== */}
          {/* Amenities live on the primary building (physical asset). */}
          <SectionHeader
            title="Amenities"
            right={primaryBuilding ? <Link href={`/buildings/${primaryBuilding.id}/edit`} className="text-sm text-blue-700 hover:underline">Edit</Link> : undefined}
          />
          <Section>
            {Array.isArray(primaryBuilding?.amenities) && primaryBuilding.amenities.length > 0 ? (
              <ul className="px-5 py-3 text-sm">{primaryBuilding.amenities.map((a: any, i: number) => <li key={i}>• {a}</li>)}</ul>
            ) : <p className="px-5 py-4 text-sm text-gray-500">—</p>}
          </Section>

          {/* ============== PROPERTIES (BUILDINGS) ============== */}
          {/* One association can govern many physical buildings. This section
              lists them with a quick-add for more. */}
          <SectionHeader
            title="Properties"
            right={
              <Link
                href={`/buildings/new?association=${id}`}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + Add Property
              </Link>
            }
          />
          <Section>
            {buildingsList.length === 0 ? (
              <p className="px-5 py-4 text-center text-sm text-gray-500">
                No physical properties yet. <Link href={`/buildings/new?association=${id}`} className="text-blue-700 hover:underline">Add one →</Link>
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {buildingsList.map((b: any) => (
                  <li key={b.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/buildings/${b.id}`} className="font-medium text-blue-700 hover:underline">{b.name}</Link>
                        {b.is_primary && <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">Primary</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {b.address}
                        {b.city && ` · ${b.city}${b.state ? ', ' + b.state : ''} ${b.zip ?? ''}`}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {b.year_built ? `Built ${b.year_built}` : ''}
                      {b.site_manager && <span className="ml-2">· {b.site_manager}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ============== UNITS ============== */}
          <SectionHeader title="Units" right={<span className="text-xs text-gray-500">{ownerOccupied}% Owner Occupied</span>} />
          <Section>
            {(units ?? []).length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-gray-500">No units linked yet. <Link href={`/units/new?association=${id}`} className="text-blue-700 hover:underline">Add one →</Link></p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Unit</th>
                      <th className="px-4 py-2 text-left font-semibold">Owner</th>
                      <th className="px-4 py-2 text-left font-semibold">Tenant Occupied</th>
                      <th className="px-4 py-2 text-right font-semibold">Ownership Percentage</th>
                      <th className="px-4 py-2 text-right font-semibold">Dues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(units ?? []).map((u: any) => {
                      const ownerName = u.owners?.last_name && u.owners?.first_name
                        ? `${u.owners.first_name} ${u.owners.last_name}`
                        : u.owners?.full_name ?? '—';
                      return (
                        <tr key={u.id} className="border-t border-gray-100">
                          <td className="px-4 py-2">
                            <Link href={`/units/${u.unit_id}`} className="text-blue-700 hover:underline">
                              {u.units?.unit_number ?? '—'}
                            </Link>
                          </td>
                          <td className="px-4 py-2">
                            <Link href={`/owners`} className="text-blue-700 hover:underline">{ownerName}</Link>
                          </td>
                          <td className="px-4 py-2 text-gray-700">{u.occupancy_type === 'tenant' ? 'Yes' : '—'}</td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {u.share_pct != null ? `${Number(u.share_pct).toFixed(10)}%` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{u.dues_amount != null ? money(u.dues_amount) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
                  Displaying: 1-{units?.length ?? 0} of {units?.length ?? 0}
                </div>
              </>
            )}
          </Section>

          {/* ============== ASSOCIATION FINANCIALS ============== */}
          <SectionHeader title="Association Financials" right={<Link href={`/owners/new`} className="text-sm text-blue-700 hover:underline">New Ownership</Link>} />
          <Section>
            <div className="flex items-start gap-3 border-b border-gray-100 bg-amber-50 px-5 py-3 text-sm text-amber-900">
              <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-bold uppercase text-amber-900">NEW</span>
              <div className="flex-1">
                <div className="font-semibold">Flexible Owner Distribution Percentages</div>
                <div className="text-xs">You can now allocate owner distribution income independently of property ownership percentage, giving you more flexibility to pay your owners how they want to be paid.</div>
              </div>
              <button className="rounded border border-amber-400 bg-white px-3 py-1 text-xs font-medium text-amber-900">FEEDBACK</button>
            </div>
            <dl className="divide-y divide-gray-100 text-sm">
              <Row label="Ownership Sum Due" value="—" right={<EditLink id={id} />} />
            </dl>
            <p className="px-5 py-3 text-center text-sm text-gray-500">C&amp;R will be automated.</p>

            <div className="border-t border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">Distributions</div>
            <dl className="divide-y divide-gray-100 text-sm">
              <Row label="Payments Type" value="Net Income" />
              <Row label="Reserve Funds" value={money(assoc.reserve_funds ?? 0)} />
            </dl>
            <div className="border-t border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">Reporting</div>
            <dl className="divide-y divide-gray-100 text-sm">
              <Row label="Vendor 1099 Payer" value={dash((assoc as any).vendor_1099_payer, 'Management Company')} />
              <Row label="Fiscal Year End" value={MONTHS[((assoc.fiscal_year_start ?? 1) + 10) % 12]} />
            </dl>
          </Section>

          {/* ============== MANAGEMENT FEES ============== */}
          <SectionHeader title="Management Fees" right={<Link href="#" className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">+ New Management Fee Policy</Link>} />
          <Section>
            {(mgmtFees ?? []).length === 0 ? (
              <p className="px-5 py-4 text-center text-sm text-gray-500">No management fee policies defined.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(mgmtFees ?? []).map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <div className="font-medium">{date(p.effective_from)} — {p.effective_to ? date(p.effective_to) : '(No End Date)'}</div>
                      <div className="text-xs text-gray-500">{p.fee_type?.replace(/_/g, ' ')}</div>
                    </div>
                    <div className="tabular-nums font-medium">{money(p.amount)}</div>
                    <Link href="#" className="text-xs text-blue-700 hover:underline">Edit Current Policy</Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ============== ADDITIONAL FEES ============== */}
          <SectionHeader title="Additional Fees" right={<EditLink id={id} />} />
          <Section>
            {(additionalFees ?? []).length === 0 ? (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Additional Fees</th>
                      <th className="px-4 py-2 text-left font-semibold">GL Account</th>
                      <th className="px-4 py-2 text-left font-semibold">Percentage</th>
                      <th className="px-4 py-2 text-left font-semibold">Expenses</th>
                    </tr>
                  </thead>
                </table>
                <p className="px-5 py-4 text-center text-sm text-gray-500">C&amp;R will be automated. No management fees at this time.</p>
              </>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Label</th>
                    <th className="px-4 py-2 text-left font-semibold">GL Account</th>
                    <th className="px-4 py-2 text-right font-semibold">Percentage</th>
                    <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(additionalFees ?? []).map((f: any) => (
                    <tr key={f.id} className="border-t border-gray-100">
                      <td className="px-4 py-2">{f.label}</td>
                      <td className="px-4 py-2">{f.gl_accounts ? `${f.gl_accounts.number}: ${f.gl_accounts.name}` : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{f.percentage ? `${f.percentage}%` : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{f.amount ? money(f.amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* ============== LATE FEE POLICY ============== */}
          <SectionHeader title="Late Fee Policy" right={<EditLink id={id} />} />
          <Section>
            <div className="px-5 py-3 text-sm font-semibold text-gray-800">Current Late Fee Policy</div>
            <dl className="divide-y divide-gray-100 text-sm">
              <Row label="Base Amount" value={`Flat fee of ${money(assoc.late_fee_amount_override ?? 0)}`} />
              <Row label="Eligible Charges" value={dash(assoc.late_fee_eligible_charges, 'All')} />
              <Row label="Daily Amount / Monthly Max" value="—" />
              <Row label="Grace Period" value={`Late fees post after ${assoc.late_fee_grace_days_override ?? 4} days`} />
              <Row label="Grace Balance" value={money(0)} />
            </dl>
          </Section>

          {/* ============== BUDGETS ============== */}
          <SectionHeader title="Budgets" right={<EditLink id={id} />} />
          <Section>
            <div className="px-5 py-3 text-sm font-semibold text-gray-800">Budget Variance Threshold <span className="text-gray-400">?</span></div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Amount ($)</th>
                  <th className="px-4 py-2 text-left font-semibold">And/Or</th>
                  <th className="px-4 py-2 text-left font-semibold">Percentage (%)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-2 tabular-nums">{assoc.budget_variance_threshold_amount ? money(assoc.budget_variance_threshold_amount) : '—'}</td>
                  <td className="px-4 py-2">{dash(assoc.budget_variance_threshold_op)}</td>
                  <td className="px-4 py-2 tabular-nums">{assoc.budget_variance_threshold_pct ? `${assoc.budget_variance_threshold_pct}%` : '—'}</td>
                </tr>
              </tbody>
            </table>
            <p className="px-5 py-3 text-xs text-gray-500">
              Specify a threshold amount and/or percentage to enable color-coding and visual blurbs on the Variance page.
            </p>
            <div className="border-t border-gray-100 px-5 py-2">
              <Link href="#" className="text-xs text-blue-700 hover:underline">Bulk Update Budget Variance Thresholds</Link>
            </div>
          </Section>

          {/* ============== INTEREST INFORMATION ============== */}
          <SectionHeader title="Interest Information" />
          <Section>
            {!assoc.interest_income_gl_account_id && (
              <div className="border-b border-gray-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
                ⚠ In order to automatically charge monthly Interest, please assign your Interest Income GL Accounts to the new Key Interest Income Accounts.{' '}
                <Link href="/gl-accounts" className="font-semibold text-blue-700 hover:underline">Assign your Key Account.</Link>
              </div>
            )}
            <dl className="divide-y divide-gray-100 text-sm">
              <Row label="Subject To Interest After" value={`${assoc.interest_grace_days ?? 15} days`} />
              <Row label="Interest Posts Automatically On" value={ordinal(assoc.interest_post_day_of_month ?? 15) + ' of the month'} />
              <Row label="Grace Balance" value={(assoc.interest_grace_balance ?? 0).toFixed(2)} />
              <Row label="Annual Interest Rate" value={`${assoc.annual_interest_rate ?? 0}% (${((assoc.annual_interest_rate ?? 0) / 12).toFixed(2)}% will be charged monthly)`} />
            </dl>
          </Section>

          {/* ============== KEYS ============== */}
          <SectionHeader title="Keys" right={<Link href="#" className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">+ Add Key</Link>} />
          <Section>
            {(keys ?? []).length === 0 ? (
              <p className="px-5 py-4 text-center text-sm text-gray-500">Click &lsquo;Add Key&rsquo; to add Keys.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(keys ?? []).map((k: any) => (
                  <li key={k.id} className="flex items-center justify-between px-5 py-2 text-sm">
                    <div>
                      <span className="font-medium">{k.label}</span>
                      {k.key_number && <span className="ml-2 text-xs text-gray-500">#{k.key_number}</span>}
                    </div>
                    <span className="text-xs text-gray-600">{k.held_by ?? '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ============== VIOLATION FOLLOW-UP SCHEDULE ============== */}
          <SectionHeader title="Violation Follow-up Schedule" right={<EditLink id={id} />} />
          <Section>
            <div className="px-5 py-3 text-sm font-semibold text-gray-800">Default Schedule Settings</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Days <span className="text-gray-400">?</span></th>
                  <th className="px-4 py-2 text-left font-semibold">Follow-up Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Letter Template</th>
                  <th className="px-4 py-2 text-left font-semibold">Delivery Methods <span className="text-gray-400">?</span></th>
                  <th className="px-4 py-2 text-left font-semibold">Fee</th>
                  <th className="px-4 py-2 text-left font-semibold">GL Account</th>
                </tr>
              </thead>
              <tbody>
                {(violationSteps ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">Click &lsquo;Edit&rsquo; to add Violation Settings.</td></tr>
                ) : (violationSteps ?? []).map((s: any) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 tabular-nums">{s.days_after_previous}</td>
                    <td className="px-4 py-2">{s.follow_up_name}</td>
                    <td className="px-4 py-2">{s.document_templates?.name ?? '—'}</td>
                    <td className="px-4 py-2">{(s.delivery_methods ?? []).join(', ')}</td>
                    <td className="px-4 py-2">{s.fee ? money(s.fee) : '—'}</td>
                    <td className="px-4 py-2">{'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">Communication Settings</div>
            <dl className="divide-y divide-gray-100 text-sm">
              <Row label="Sender Name" value={dash(assoc.violation_sender_name, 'Stellar Property Management')} />
              <Row label="Sender Email" value={assoc.violation_sender_email_uses_logged_in_user
                ? <>Logged-in user during Violations processing <span className="text-gray-400">?</span></>
                : dash(assoc.violation_sender_email)} />
            </dl>
          </Section>

          {/* ============== MAINTENANCE INFORMATION ============== */}
          {/* Maintenance fields now live on the primary building (physical asset). */}
          <SectionHeader
            title="Maintenance Information"
            right={primaryBuilding ? <Link href={`/buildings/${primaryBuilding.id}/edit`} className="text-sm text-blue-700 hover:underline">Edit</Link> : undefined}
          />
          <Section>
            {primaryBuilding ? (
              <dl className="divide-y divide-gray-100 text-sm">
                <Row label="Maintenance Limit" value={(primaryBuilding.maintenance_limit ?? 0).toFixed(2)} />
                <Row label="Insurance Expiration" value={dash(date(primaryBuilding.insurance_expiration))} />
                <Row label="Has Home Warranty Coverage" value={yn(primaryBuilding.home_warranty_covered)} />
                <Row label="Disable Online Maintenance Requests" value={yn(primaryBuilding.disable_online_maintenance_requests)} />
                <Row label="Unit Entry Pre-authorized" value={yn(primaryBuilding.unit_entry_pre_authorized)} />
                <Row label="Maintenance Notes" value={dash(primaryBuilding.maintenance_notes)} />
                <Row label="Online Maintenance Request Instructions" value={dash(primaryBuilding.online_maintenance_request_instructions)} />
              </dl>
            ) : (
              <p className="px-5 py-4 text-sm text-gray-500">Add a property to configure maintenance.</p>
            )}
          </Section>

          {/* ============== FIXED ASSETS ============== */}
          <SectionHeader title="Fixed Assets" right={<Link href="/fixed-assets" className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">+ Add Asset</Link>} />
          <Section>
            {(fixedAssets ?? []).length === 0 ? (
              <p className="px-5 py-4 text-center text-sm text-gray-500">Click &lsquo;Add Asset&rsquo; to add a Fixed Asset.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(fixedAssets ?? []).map((f: any) => (
                  <li key={f.id} className="flex items-center justify-between px-5 py-2 text-sm">
                    <div>
                      <span className="font-medium">{f.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{f.asset_type}</span>
                    </div>
                    <span className="tabular-nums text-gray-700">{money(f.purchase_price)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ============== PROPERTY GROUPS ============== */}
          <SectionHeader title="Property Groups" right={<EditLink id={id} />} />
          <Section>
            {propertyGroup?.property_groups ? (
              <div className="px-5 py-3 text-sm">{(propertyGroup.property_groups as any).name}</div>
            ) : (
              <p className="px-5 py-4 text-center text-sm text-gray-500">Click &lsquo;Edit&rsquo; to add property groups.</p>
            )}
          </Section>

          {/* ============== STATEMENT SETTINGS ============== */}
          <SectionHeader title="Statement Settings" right={<EditLink id={id} />} />
          <Section>
            <dl className="divide-y divide-gray-100 text-sm">
              <Row label="Use Enhanced Statement" value={yn(assoc.use_enhanced_statement)} />
              <Row label="Include Current & Upcoming Charges" value={yn(assoc.include_current_and_upcoming_charges)} />
              <Row label="Include Upcoming Charges In Amount Due" value={yn(assoc.include_upcoming_in_amount_due)} />
              <Row label="Upcoming Charges Timeframe" value={(assoc.upcoming_charges_timeframe ?? 'next_month').replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase())} />
              <Row label="Include Current Message" value={yn(assoc.include_current_message_on_statement)} />
              <Row label="Include Logo" value={yn(assoc.include_logo_on_statement)} />
              <Row label="Charge History Includes" value={(assoc.charge_history_includes ?? 'all_past_due_charges').replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase())} />
              <Row label="Include Payments Due Date" value={yn(assoc.include_payments_due_date)} />
              <Row label="Include Payments History and Balance Forward" value={yn(assoc.include_payments_history_and_balance_forward)} />
              <Row label="Show Remaining Amount Due for Past Due Charges" value={yn(assoc.show_remaining_amount_for_past_due_charges)} />
              <Row label="Include Payment Coupon on Statement" value={yn(assoc.include_payment_coupon_on_statement)} />
            </dl>
          </Section>

          {/* ============== BANK ACCOUNTS ============== */}
          <SectionHeader title="Bank Accounts" right={<EditLink id={id} />} />
          <Section>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Cash GL Account</th>
                  <th className="px-4 py-2 text-left font-semibold">Bank Account</th>
                  <th className="px-4 py-2 text-left font-semibold">Payments Enabled</th>
                </tr>
              </thead>
              <tbody>
                {(bankAccounts ?? []).length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">No bank accounts linked.</td></tr>
                ) : (bankAccounts ?? []).map((b: any) => (
                  <tr key={b.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{b.gl_accounts ? `${b.gl_accounts.number} ${b.gl_accounts.name}` : '—'}</td>
                    <td className="px-4 py-2">
                      <Link href={`/bank-accounts`} className="text-blue-700 hover:underline">{b.name}</Link>
                      {b.bank_name && <span className="ml-1 text-xs text-gray-500">({b.bank_name})</span>}
                      {b.purpose && (
                        <div className="text-xs capitalize text-gray-500">
                          {b.purpose === 'operating' ? 'Operating & Escrow Account' : b.purpose.replace(/_/g, ' ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${b.payments_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {b.payments_enabled ? 'Enabled' : 'Not enabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* ============== TERMS AND CONDITIONS ============== */}
          <SectionHeader title="Terms and Conditions for Electronic Document Delivery" right={<EditLink id={id} />} />
          <Section>
            {assoc.electronic_doc_delivery_terms ? (
              <p className="whitespace-pre-wrap px-5 py-4 text-sm text-gray-700">{assoc.electronic_doc_delivery_terms}</p>
            ) : (
              <p className="px-5 py-4 text-center text-sm text-gray-500">Click &lsquo;Edit&rsquo; to add Terms and Conditions.</p>
            )}
          </Section>

          {/* ============== PHOTOS ============== */}
          <SectionHeader title="Photos" right={<button className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Upload Files</button>} />
          <Section>
            <div className="m-5 rounded border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              Drop files here to upload.
            </div>
          </Section>

          {/* ============== NOTES ============== */}
          <SectionHeader title="Notes" right={
            <div className="flex gap-2">
              <button className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">⇣ Standard Notes</button>
              <button className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">+ Add Note</button>
            </div>
          } />
          <Section>
            {(notes ?? []).length === 0 ? (
              <p className="px-5 py-4 text-center text-sm text-gray-500">No notes yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(notes ?? []).map((n: any) => (
                  <li key={n.id} className="px-5 py-2 text-sm">
                    <div className="whitespace-pre-wrap text-gray-800">{n.body}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {n.profiles?.full_name ?? '—'} · {date(n.created_at)}{n.is_standard && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">standard</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ============== AUDIT LOG ============== */}
          <SectionHeader title="Audit Log" />
          <Section>
            {auditEntries.length === 0 ? (
              <p className="px-5 py-4 text-center text-sm text-gray-500">No audit events yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {auditEntries.slice(0, 4).map((a, i) => (
                  <li key={i} className="flex items-start gap-4 px-5 py-2">
                    <span className="whitespace-nowrap text-xs text-gray-500">{new Date(a.date).toLocaleString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="flex-1 text-gray-700">{a.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ============== ATTACHMENTS ============== */}
          <SectionHeader title="Attachments" />
          <Section>
            <div className="m-5 rounded border-2 border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-600">
              <strong>Drag Files Here</strong>
              <span className="mx-3 text-gray-400">or</span>
              <label className="inline-block cursor-pointer rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">
                Choose Files to Add
                <input type="file" multiple className="hidden" />
              </label>
            </div>

            {folders.size > 0 && (
              <>
                <div className="border-t border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">Folders <Link href="#" className="ml-2 text-xs font-normal text-blue-700 hover:underline">+ Add Folder</Link></div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                    <tr><th className="px-4 py-2 text-left font-semibold">Name</th><th className="px-4 py-2 text-right font-semibold">Number of Files</th></tr>
                  </thead>
                  <tbody>
                    {Array.from(folders.entries()).map(([folder, files]) => (
                      <tr key={folder} className="border-t border-gray-100">
                        <td className="px-4 py-2">{folder}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{files.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className="border-t border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">Files</div>
            <div className="px-5 py-2 text-xs text-gray-500 space-x-2">
              <Link href="#" className="text-blue-700 hover:underline">Bulk Actions</Link>
              <span>·</span>
              <Link href="#" className="text-blue-700 hover:underline">Share with Owners</Link>
              <span>·</span>
              <Link href="#" className="text-blue-700 hover:underline">Unshare with Owners</Link>
              <span>·</span>
              <Link href="#" className="text-blue-700 hover:underline">Add to Folder</Link>
              <span>·</span>
              <Link href="#" className="text-blue-700 hover:underline">Download</Link>
              <span>·</span>
              <Link href="#" className="text-blue-700 hover:underline">Delete</Link>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="w-8 px-4 py-2"><input type="checkbox" /></th>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Uploaded by</th>
                  <th className="px-4 py-2 text-left font-semibold">Date</th>
                  <th className="px-4 py-2 text-left font-semibold">Shared</th>
                  <th className="px-4 py-2 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {unfiled.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">No files uploaded.</td></tr>
                ) : unfiled.map((f: any) => (
                  <tr key={f.id} className="border-t border-gray-100">
                    <td className="px-4 py-2"><input type="checkbox" /></td>
                    <td className="px-4 py-2"><Link href="#" className="text-blue-700 hover:underline">{f.file_name}</Link></td>
                    <td className="px-4 py-2">{f.profiles?.full_name ?? '—'}</td>
                    <td className="px-4 py-2">{date(f.created_at)}</td>
                    <td className="px-4 py-2">{f.shared_with_owner ? '✓' : '—'}</td>
                    <td className="px-4 py-2"><Link href="#" className="text-xs text-blue-700 hover:underline">▾</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">Displaying: 1-{unfiled.length} of {unfiled.length}</div>
          </Section>

          <div className="mt-6 text-xs text-gray-500">
            <Link href="#" className="text-blue-700 hover:underline">Privacy</Link>
            <span className="mx-2">|</span>
            <Link href="#" className="text-blue-700 hover:underline">Help &amp; Training</Link>
            <span className="mx-2">|</span>
            <Link href="#" className="text-blue-700 hover:underline">Make a Suggestion »</Link>
          </div>
        </div>
      </div>

      {/* ================= RIGHT CONTEXT PANEL — Association DETAIL version ================= */}
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks" icon="★">
          <PanelLink href={`/charges?assoc=${id}`}>Update Assessments</PanelLink>
          <PanelLink href={`/units/new?association=${id}`}>New Unit</PanelLink>
          <PanelLink href="#">New Resale Buyer</PanelLink>
          <PanelLink href="#">New Approval</PanelLink>
          <PanelLink href="/bank-accounts/new">New Account</PanelLink>
          <PanelLink href={`/bank-transfers`}>Transfer Funds Between Cash Accounts</PanelLink>
          <PanelLink href="/portal/service-requests/new">New Service Request</PanelLink>
          <PanelLink href={`/work-orders?assoc=${id}`}>Work Orders</PanelLink>
          <PanelLink href={`/purchase-orders`}>Purchase Orders</PanelLink>
          <PanelLink href="#">Rules &amp; Regulations</PanelLink>
          <PanelLink href={`/inspections/new?association=${id}`}>New Inspection</PanelLink>
          <PanelLink href={`/inspections?assoc=${id}`}>View Inspections</PanelLink>
          <PanelLink href={`/associations/${id}/edit`}>Edit Association</PanelLink>
          <PanelLink href={`/send-email?association=${id}`}>Email Association</PanelLink>
          <PanelLink href="#">Hide Association</PanelLink>
        </PanelSection>

        <PanelSection title="In Reports" icon="▤">
          <PanelLink href="/reports/owner_directory">Owner Directory</PanelLink>
          <PanelLink href={`/units?assoc=${id}`}>Unit Directory</PanelLink>
          <PanelLink href="/owners?view=tenants">Tenant Directory</PanelLink>
          <PanelLink href="/reports/dues_roll">Dues Roll</PanelLink>
          <PanelLink href="/reports/general_ledger">General Ledger</PanelLink>
          <PanelLink href="/reports/work_order_report">Association Work Orders</PanelLink>
          <PanelLink href={`/calendar?assoc=${id}`}>Activities Summary</PanelLink>
        </PanelSection>

        <PanelSection title="Letters" icon="✉">
          <PanelLink href={`/send-email?association=${id}`}>Send Statements</PanelLink>
        </PanelSection>

        <PanelSection title="Help Topics" icon="?">
          <PanelLink href="#">Managing HOAs</PanelLink>
          <PanelLink href="#">Sending Owner Statements</PanelLink>
          <PanelLink href="#">Uploading Lockbox File</PanelLink>
          <PanelLink href="#">Converting Lockbox File</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}

// ============================================================================
// Presentational helpers
// ============================================================================

function Section({ children }: { children: React.ReactNode }) {
  return <section className="mb-4 overflow-hidden rounded border border-gray-200 bg-white">{children}</section>;
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mt-4 mb-0 flex items-center justify-between rounded-t border border-b-0 border-gray-200 bg-white px-5 py-3">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {right}
    </div>
  );
}

function Row({ label, value, right }: { label: React.ReactNode; value: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-2">
      <dt className="w-80 shrink-0 text-right text-gray-600">{label}</dt>
      <dd className="flex-1 text-left text-gray-900">{value}</dd>
      {right}
    </div>
  );
}

function EditLink({ id }: { id: string }) {
  return <Link href={`/associations/${id}/edit`} className="text-sm text-blue-700 hover:underline">Edit</Link>;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
