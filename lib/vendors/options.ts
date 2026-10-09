// Values mirror the Postgres enums (vendor_trade, vendor_type, vendor_payment_type).
const TRADE_LABELS = {
  alarm_security: 'Alarm & security', appliances: 'Appliances', capital_improvements: 'Capital improvements',
  carpet_flooring: 'Carpet & flooring', cleaning_janitorial: 'Cleaning & janitorial', decks_balconies: 'Decks & balconies',
  doors_windows: 'Doors & windows', drywall: 'Drywall', electrical: 'Electrical', elevator: 'Elevator',
  fences_gates: 'Fences & gates', fire_life_safety: 'Fire & life safety', fire_water_damage: 'Fire & water damage restoration',
  fireplace_chimney: 'Fireplace & chimney', garage_doors: 'Garage doors', general_contractor: 'General contractor',
  gutter_cleaning: 'Gutter cleaning', handyperson: 'Handyperson', hvac: 'HVAC', inspections: 'Inspections',
  keys_locks: 'Keys & locks', landscaping: 'Landscaping', painting: 'Painting', parking_driveways: 'Parking & driveways',
  pest_control: 'Pest control', plumbing: 'Plumbing', pool_spa: 'Pool & spa', preventative_maintenance: 'Preventative maintenance',
  redevelopment: 'Redevelopment', repairs_exterior: 'Exterior repairs', repairs_interior: 'Interior repairs', roofing: 'Roofing',
  septic: 'Septic', smoke_co_detectors: 'Smoke & CO detectors', snow_removal: 'Snow removal', trash_recycling: 'Trash & recycling',
  turnover: 'Turnover', utilities: 'Utilities', other: 'Other',
} as const;
export type VendorTrade = keyof typeof TRADE_LABELS;
/** Every vendor_trade enum value, alphabetical by label with "Other" last. */
export const VENDOR_TRADES = (Object.keys(TRADE_LABELS) as VendorTrade[]).sort((a, b) =>
  a === 'other' ? 1 : b === 'other' ? -1 : TRADE_LABELS[a].localeCompare(TRADE_LABELS[b]),
);
export const tradeLabel = (v: string | null | undefined) =>
  (v && (TRADE_LABELS as Record<string, string>)[v]) ??
  (v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : 'Other');
export const VENDOR_TYPES = ['general', 'contractor', 'sub_contractor', 'service_provider', 'other'] as const;
export const VENDOR_PAYMENT_TYPES = ['check', 'echeck', 'ach', 'online'] as const;
export const CHECK_CONSOLIDATION = [
  { value: 'single_check', label: 'All bills on a single check' },
  { value: 'per_bill', label: 'One check per bill' },
] as const;
export const CHECK_STUB = [
  { value: 'expanded', label: 'List each bill detail line item' },
  { value: 'summary', label: 'One line per bill' },
] as const;

/** Each association has its own vendor records (the same company can have one
 * per association): name the record's association, or the management company. */
export const vendorAssociationLabel = (
  v: { is_management_company?: boolean | null; associations?: { name?: string | null } | null } | null | undefined,
) => (v?.is_management_company ? 'Management company' : v?.associations?.name ?? 'No association');
