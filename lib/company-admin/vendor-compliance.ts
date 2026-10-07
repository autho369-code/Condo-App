import { addDaysToDate } from '@/lib/time/zoned'

// Expiration columns are calendar dates. Parsing them with new Date() made a
// document "expired" at UTC midnight of its expiry day (evening of the day
// before in US zones); compare calendar dates in the company zone instead.
// A document is valid through its expiration date.

export const VENDOR_EXPIRATION_FIELDS = [
  'workers_comp_expiration',
  'general_liability_expiration',
  'auto_insurance_expiration',
  'epa_certification_expiration',
  'state_license_expiration',
  'contract_expiration',
] as const

/** The same columns as one select list (kept as a literal so the column check can read it). */
export const VENDOR_EXPIRATION_COLUMNS =
  'workers_comp_expiration, general_liability_expiration, auto_insurance_expiration, epa_certification_expiration, state_license_expiration, contract_expiration'

export type VendorComplianceStatus = 'none' | 'expired' | 'expiring' | 'compliant'

export function vendorComplianceStatus(vendor: Record<string, unknown>, today: string, windowDays = 30): VendorComplianceStatus {
  const dates = VENDOR_EXPIRATION_FIELDS
    .map((field) => vendor[field])
    .filter((v): v is string => typeof v === 'string' && v.length >= 10)
    .map((v) => v.slice(0, 10))
  if (dates.length === 0) return 'none'
  if (dates.some((d) => d < today)) return 'expired'
  const horizon = addDaysToDate(today, windowDays)
  if (dates.some((d) => d <= horizon)) return 'expiring'
  return 'compliant'
}
