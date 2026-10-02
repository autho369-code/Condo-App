import { Field, Input, Select } from '@/components/ui/input';

export const ASSET_STATUSES = ['active', 'disposed', 'sold', 'fully_depreciated'];
export const DEPRECIATION_METHODS = ['straight_line', 'declining_balance', 'sum_of_years_digits', 'units_of_production', 'none'];

export function label(value: string | null | undefined) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

type Option = { id: string; name: string };
type UnitOption = { id: string; label: string; association_id: string };

/** The asset form fields, shared by Add Fixed Asset and the asset's edit form. */
export function AssetFields({
  associations,
  units,
  asset,
}: {
  associations: Option[];
  units: UnitOption[];
  asset?: any;
}) {
  const a = asset ?? {};
  const disposedDay = a.disposed_at ? String(a.disposed_at).slice(0, 10) : '';
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Asset name" htmlFor="name"><Input id="name" name="name" required defaultValue={a.name ?? ''} placeholder="e.g. Pool pump" /></Field>
      <Field label="Type" htmlFor="asset_type"><Input id="asset_type" name="asset_type" defaultValue={a.asset_type ?? ''} placeholder="e.g. Equipment" /></Field>
      <Field label="Association" htmlFor="association_id" hint="Leave empty for a company-wide asset.">
        <Select id="association_id" name="association_id" defaultValue={a.association_id ?? ''}>
          <option value="">None</option>
          {associations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      </Field>
      <Field label="Unit" htmlFor="unit_id" hint="Optional; sets the association too.">
        <Select id="unit_id" name="unit_id" defaultValue={a.unit_id ?? ''}>
          <option value="">None</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </Select>
      </Field>
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={a.status ?? 'active'}>
          {ASSET_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
      </Field>
      <Field label="Placed in service" htmlFor="placed_in_service_date"><Input id="placed_in_service_date" name="placed_in_service_date" type="date" defaultValue={a.placed_in_service_date ?? ''} /></Field>
      <Field label="Warranty expiration" htmlFor="warranty_expiration_date"><Input id="warranty_expiration_date" name="warranty_expiration_date" type="date" defaultValue={a.warranty_expiration_date ?? ''} /></Field>
      <Field label="Make" htmlFor="make"><Input id="make" name="make" defaultValue={a.make ?? ''} /></Field>
      <Field label="Model" htmlFor="model"><Input id="model" name="model" defaultValue={a.model ?? ''} /></Field>
      <Field label="Serial number" htmlFor="serial_number"><Input id="serial_number" name="serial_number" defaultValue={a.serial_number ?? ''} /></Field>
      <Field label="Purchase date" htmlFor="purchase_date"><Input id="purchase_date" name="purchase_date" type="date" defaultValue={a.purchase_date ?? ''} /></Field>
      <Field label="Cost" htmlFor="purchase_price"><Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0" defaultValue={a.purchase_price ?? ''} placeholder="0.00" /></Field>
      <Field label="Salvage value" htmlFor="salvage_value"><Input id="salvage_value" name="salvage_value" type="number" step="0.01" min="0" defaultValue={a.salvage_value ?? ''} placeholder="0.00" /></Field>
      <Field label="Useful life (years)" htmlFor="useful_life_years"><Input id="useful_life_years" name="useful_life_years" type="number" min="0" step="1" defaultValue={a.useful_life_years ?? ''} /></Field>
      <Field label="Depreciation method" htmlFor="depreciation_method">
        <Select id="depreciation_method" name="depreciation_method" defaultValue={a.depreciation_method ?? 'straight_line'}>
          {DEPRECIATION_METHODS.map((d) => <option key={d} value={d}>{label(d)}</option>)}
        </Select>
      </Field>
      <Field label="Disposal or sale date" htmlFor="disposed_date" hint="Only for disposed or sold assets.">
        <Input id="disposed_date" name="disposed_date" type="date" defaultValue={disposedDay} />
      </Field>
      <Field label="Disposal or sale amount" htmlFor="disposed_amount" hint="Only for disposed or sold assets.">
        <Input id="disposed_amount" name="disposed_amount" type="number" step="0.01" min="0" defaultValue={a.disposed_amount ?? ''} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description" htmlFor="description"><Input id="description" name="description" defaultValue={a.description ?? ''} placeholder="Optional" /></Field>
      </div>
    </div>
  );
}
