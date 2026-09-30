// Values mirror the Postgres enums (vendor_trade, vendor_type, vendor_payment_type).
export const VENDOR_TRADES = [
  'hvac', 'plumbing', 'electrical', 'landscaping', 'roofing', 'general_contractor', 'handyperson', 'snow_removal',
  'pest_control', 'pool_spa', 'painting', 'keys_locks', 'fireplace_chimney', 'garage_doors', 'gutter_cleaning',
  'inspections', 'parking_driveways', 'preventative_maintenance', 'repairs_exterior', 'repairs_interior', 'septic',
  'trash_recycling', 'utilities', 'turnover', 'other',
] as const;
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
