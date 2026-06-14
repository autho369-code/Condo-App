import { Car } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { money, date } from '@/lib/utils';
import { assignParkingSpace, createParkingSpace, releaseParkingSpace } from './actions';

export const dynamic = 'force-dynamic';

const SPACE_TYPES = ['standard', 'covered', 'garage', 'tandem', 'accessible', 'other'];
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

const BANNERS: Record<string, string> = {
  space_added: 'Parking space added.',
  assigned: 'Space assigned.',
  released: 'Space released.',
  vehicle_updated: 'Vehicle details updated.',
};

export default async function ParkingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: spaces }, { data: assignments }, { data: associations }, { data: units }, { data: tenants }] = await Promise.all([
    db.from('parking_spaces')
      .select('id, label, space_type, monthly_fee, deposit_amount, notes, association_id, associations(name)')
      .eq('portfolio_id', me.portfolio?.id).is('archived_at', null).eq('active', true).order('label'),
    db.from('parking_assignments')
      .select('id, parking_space_id, unit_id, tenant_id, occupant_name, start_date, monthly_fee, deposit_amount, deposit_paid, deposit_returned, vehicle_make, vehicle_model, vehicle_color, license_plate, insurance_company, insurance_policy_number, units(unit_number), tenants(first_name, last_name), owners(full_name)')
      .eq('portfolio_id', me.portfolio?.id).eq('status', 'active'),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('units').select('id, unit_number, buildings!inner(association_id)').is('archived_at', null).order('unit_number'),
    db.from('tenants').select('id, first_name, last_name, unit_id').eq('status', 'active').is('archived_at', null),
  ]);

  const activeBySpace = new Map<string, any>();
  (assignments ?? []).forEach((a: any) => activeBySpace.set(a.parking_space_id, a));

  const allSpaces = spaces ?? [];
  const occupied = allSpaces.filter((s: any) => activeBySpace.has(s.id));
  const available = allSpaces.length - occupied.length;
  const depositsHeld = (assignments ?? []).reduce((sum: number, a: any) => sum + (a.deposit_paid && !a.deposit_returned ? Number(a.deposit_amount ?? 0) : 0), 0);
  const banner = Object.keys(BANNERS).find((k) => sp[k] === '1');

  // Unit the space is assigned to (primary), plus who uses it (secondary).
  const assignedUnit = (a: any) => (a.units?.unit_number ? `Unit ${a.units.unit_number}` : null);
  const assignedOccupant = (a: any) => {
    if (a.tenants) return `${a.tenants.first_name ?? ''} ${a.tenants.last_name ?? ''}`.trim() + ' · tenant';
    if (a.owners) return `${a.owners.full_name} · owner`;
    if (a.occupant_name) return a.occupant_name;
    return null;
  };

  return (
    <DataWorkspace
      title="Parking"
      description="Association-owned parking spaces: who's assigned, the vehicle on file, the deposit held, and turnover."
      actions={<a href="#add-space"><Button variant="secondary">Add space</Button></a>}
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="Action failed">{sp.error}</Alert>}
        {sp.warning && <Alert tone="warning" title="Heads up">{sp.warning}</Alert>}
        {banner && <Alert tone="success" title={BANNERS[banner]} />}

        <MetricStrip
          metrics={[
            { label: 'Total spaces', value: allSpaces.length },
            { label: 'Occupied', value: occupied.length },
            { label: 'Available', value: available },
            { label: 'Deposits held', value: money(depositsHeld) },
          ]}
        />

        <Surface padded={false}>
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-950">Spaces</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Space</TH>
                  <TH>Association</TH>
                  <TH>Assigned to</TH>
                  <TH>Vehicle</TH>
                  <TH>Plate</TH>
                  <TH>Insurance policy</TH>
                  <TH className="text-right">Monthly</TH>
                  <TH>Deposit</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <tbody>
                {allSpaces.length === 0 ? (
                  <TR><TD colSpan={9} className="py-10 text-center text-gray-500">No parking spaces yet. Use <a href="#add-space" className="font-medium text-gray-900 hover:underline">Add a parking space</a> below to create your first one, then assign it to a unit.</TD></TR>
                ) : (
                  allSpaces.map((space: any) => {
                    const a = activeBySpace.get(space.id);
                    const assocUnits = (units ?? []).filter((u: any) => u.buildings?.association_id === space.association_id);
                    const assocTenants = (tenants ?? []);
                    return (
                      <TR key={space.id} className="align-top">
                        <TD>
                          <div className="font-medium text-gray-900">{space.label}</div>
                          <div className="text-xs capitalize text-gray-500">{space.space_type}</div>
                        </TD>
                        <TD className="text-sm text-gray-700">{space.associations?.name ?? '—'}</TD>
                        <TD className="text-sm text-gray-900">
                          {a ? (
                            <div>
                              <div className="font-medium text-gray-900">{assignedUnit(a) ?? assignedOccupant(a) ?? '—'}</div>
                              {assignedUnit(a) && assignedOccupant(a) && (
                                <div className="text-xs text-gray-500">{assignedOccupant(a)}</div>
                              )}
                            </div>
                          ) : <StatusChip tone="success">Available</StatusChip>}
                        </TD>
                        <TD className="text-sm text-gray-700">{a ? [a.vehicle_color, a.vehicle_make, a.vehicle_model].filter(Boolean).join(' ') || '—' : '—'}</TD>
                        <TD className="text-sm tabular-nums text-gray-700">{a?.license_plate ?? '—'}</TD>
                        <TD className="text-sm text-gray-700">{a?.insurance_policy_number ?? '—'}</TD>
                        <TD className="text-right tabular-nums text-gray-700">{money(a?.monthly_fee ?? space.monthly_fee)}</TD>
                        <TD className="text-sm">
                          {a
                            ? (a.deposit_paid
                                ? <StatusChip tone="success">Held {money(a.deposit_amount)}</StatusChip>
                                : <StatusChip tone="warning">Unpaid</StatusChip>)
                            : (space.deposit_amount ? <span className="text-xs text-gray-500">{money(space.deposit_amount)} req.</span> : '—')}
                        </TD>
                        <TD className="text-right">
                          {a ? (
                            <details>
                              <summary className="cursor-pointer select-none text-xs font-medium text-gray-600 hover:text-gray-950 hover:underline">Release</summary>
                              <form action={releaseParkingSpace} className="mt-2 space-y-2 text-left">
                                <input type="hidden" name="assignment_id" value={a.id} />
                                <label className="flex items-center gap-2 text-xs text-gray-700">
                                  <input type="checkbox" name="deposit_returned" defaultChecked={a.deposit_paid} /> Deposit returned
                                </label>
                                <Button type="submit" variant="secondary" size="sm">Confirm release</Button>
                              </form>
                            </details>
                          ) : (
                            <details>
                              <summary className="cursor-pointer select-none text-xs font-medium text-blue-700 hover:underline">Assign</summary>
                              <form action={assignParkingSpace} className="mt-3 grid w-[34rem] max-w-[80vw] grid-cols-2 gap-2 text-left">
                                <input type="hidden" name="parking_space_id" value={space.id} />
                                <div className="col-span-2">
                                  <Label htmlFor={`unit-${space.id}`}>Assign to unit — {space.associations?.name ?? 'association'}</Label>
                                  <select id={`unit-${space.id}`} name="unit_id" className={inputCls}>
                                    <option value="">Select unit…</option>
                                    {assocUnits.map((u: any) => <option key={u.id} value={u.id}>Unit {u.unit_number}</option>)}
                                  </select>
                                  {assocUnits.length === 0 && <p className="mt-1 text-xs text-amber-700">This association has no units yet — add units first.</p>}
                                </div>
                                <div>
                                  <Label htmlFor={`tenant-${space.id}`}>Tenant (optional)</Label>
                                  <select id={`tenant-${space.id}`} name="tenant_id" className={inputCls}>
                                    <option value="">— owner-used —</option>
                                    {assocTenants.map((t: any) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <Label htmlFor={`occ-${space.id}`}>Or name</Label>
                                  <Input id={`occ-${space.id}`} name="occupant_name" placeholder="Free text" />
                                </div>
                                <div><Label>Vehicle make</Label><Input name="vehicle_make" /></div>
                                <div><Label>Model</Label><Input name="vehicle_model" /></div>
                                <div><Label>Color</Label><Input name="vehicle_color" /></div>
                                <div><Label>License plate</Label><Input name="license_plate" /></div>
                                <div><Label>Insurance company</Label><Input name="insurance_company" /></div>
                                <div><Label>Insurance policy #</Label><Input name="insurance_policy_number" /></div>
                                <div><Label>Monthly fee</Label><Input name="monthly_fee" type="number" step="0.01" min="0" defaultValue={space.monthly_fee || ''} /></div>
                                <div><Label>Deposit amount</Label><Input name="deposit_amount" type="number" step="0.01" min="0" defaultValue={space.deposit_amount || ''} /></div>
                                <div><Label>Start date</Label><Input name="start_date" type="date" /></div>
                                <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700">
                                  <input type="checkbox" name="deposit_paid" /> Deposit collected
                                </label>
                                <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700">
                                  <input type="checkbox" name="bill_to_unit" defaultChecked /> Auto-add the monthly fee as a recurring charge on this unit
                                </label>
                                <div className="col-span-2 flex justify-end"><Button type="submit" size="sm">Assign space</Button></div>
                              </form>
                            </details>
                          )}
                        </TD>
                      </TR>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Surface>

        {/* Add space */}
        <div id="add-space" />
        <Surface>
          <h2 className="mb-3 text-sm font-semibold text-gray-950">Add a parking space</h2>
          <form action={createParkingSpace} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="association_id">Association <span className="text-red-500">*</span></Label>
              <select id="association_id" name="association_id" required className={inputCls}>
                <option value="">Select association</option>
                {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="label">Space number / label <span className="text-red-500">*</span></Label>
              <Input id="label" name="label" required placeholder="e.g. P-14" />
            </div>
            <div>
              <Label htmlFor="space_type">Type</Label>
              <select id="space_type" name="space_type" className={`${inputCls} capitalize`}>
                {SPACE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="monthly_fee">Monthly fee</Label>
              <Input id="monthly_fee" name="monthly_fee" type="number" step="0.01" min="0" placeholder="0.00" />
            </div>
            <div>
              <Label htmlFor="deposit_amount">Deposit amount</Label>
              <Input id="deposit_amount" name="deposit_amount" type="number" step="0.01" min="0" placeholder="0.00" />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Location, restrictions…" />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit"><Car className="h-4 w-4" /> Add space</Button>
            </div>
          </form>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
