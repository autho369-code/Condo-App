// Single source of truth for the editable association record sections.
// Every key must be whitelisted in update_association_settings().

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'percent' | 'date' | 'bool' | 'select' | 'month' | 'gl';

export type SettingField = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  hint?: string;
  span?: 2;
};

export type SettingSection = { key: string; title: string; subtitle?: string; fields: SettingField[] };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const ASSOCIATION_SECTIONS: SettingSection[] = [
  {
    key: 'general',
    title: 'General',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'legal_name', label: 'Legal name', type: 'text', hint: 'As registered with the state; used on 1099s and year-end packages.' },
      { key: 'property_type', label: 'Property type', type: 'select', options: [
        { value: 'condominium', label: 'Condominium' }, { value: 'HOA', label: 'Homeowners association' },
        { value: 'townhome', label: 'Townhome association' }, { value: 'cooperative', label: 'Cooperative' }, { value: 'mixed_use', label: 'Mixed use' },
      ] },
      { key: 'tax_id', label: 'EIN', type: 'text' },
      { key: 'address', label: 'Street address', type: 'text' },
      { key: 'address_line_2', label: 'Address line 2', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text', hint: 'Two-letter code. Drives the collection protections applied to delinquencies.' },
      { key: 'zip', label: 'ZIP', type: 'text' },
      { key: 'county', label: 'County', type: 'text' },
      { key: 'year_built', label: 'Year built', type: 'number' },
      { key: 'timezone', label: 'Time zone', type: 'select', options: [
        { value: 'America/New_York', label: 'Eastern' }, { value: 'America/Chicago', label: 'Central' },
        { value: 'America/Denver', label: 'Mountain' }, { value: 'America/Phoenix', label: 'Arizona' },
        { value: 'America/Los_Angeles', label: 'Pacific' }, { value: 'America/Anchorage', label: 'Alaska' }, { value: 'Pacific/Honolulu', label: 'Hawaii' },
      ] },
      { key: 'description', label: 'Description / internal notes', type: 'textarea', span: 2, hint: 'Staff only. Owners, board members and vendors never see it.' },
    ],
  },
  {
    key: 'management',
    title: 'Management',
    fields: [
      { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
      { key: 'management_start_date', label: 'Management start date', type: 'date' },
      { key: 'management_end_date', label: 'Management end date', type: 'date' },
      { key: 'management_end_reason', label: 'End reason', type: 'text' },
    ],
  },
  {
    key: 'financial',
    title: 'Financial settings',
    fields: [
      { key: 'fiscal_year_start', label: 'Fiscal year starts', type: 'month', hint: 'Year-end packages and budgets follow this.' },
      { key: 'vendor_1099_payer', label: 'Vendor 1099 payer', type: 'select', options: [
        { value: 'use_owner', label: 'The association (its EIN)' },
        { value: 'use_management_company', label: 'The management company' },
      ] },
      { key: 'basis_for_owner_packets', label: 'Accounting basis for reports', type: 'select', options: [{ value: 'cash', label: 'Cash' }, { value: 'accrual', label: 'Accrual' }] },
      { key: 'reserve_funds', label: 'Reserve funds held outside the ledger', type: 'money' },
      { key: 'nsf_fee_amount_override', label: 'NSF (returned payment) fee', type: 'money' },
    ],
  },
  {
    key: 'interest',
    title: 'Interest on delinquent balances',
    subtitle: 'Posted automatically on the posting day each month as simple interest on overdue principal (never on prior interest). Confirm your declaration and state law allow interest and the rate.',
    fields: [
      { key: 'annual_interest_rate', label: 'Annual interest rate (%)', type: 'percent' },
      { key: 'interest_grace_days', label: 'Subject to interest after (days past due)', type: 'number' },
      { key: 'interest_post_day_of_month', label: 'Posts on day of month (1–28)', type: 'number' },
      { key: 'interest_grace_balance', label: 'Grace balance (no interest below)', type: 'money' },
      { key: 'interest_income_gl_account_id', label: 'Interest income GL account', type: 'gl' },
    ],
  },
  {
    key: 'portal',
    title: 'Owner portal & payments',
    fields: [
      { key: 'payment_frequency', label: 'Auto-pay frequency', type: 'select', options: [
        { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' },
        { value: 'semi_annually', label: 'Semi-annually' }, { value: 'annually', label: 'Annually' },
      ] },
      { key: 'owner_can_override_frequency', label: 'Owners can choose their own auto-pay frequency', type: 'bool' },
      { key: 'residents_check_fee_coverage_enabled', label: 'Association covers owners’ eCheck fees', type: 'bool' },
      { key: 'hide_calendar_in_portal', label: 'Hide the association calendar in the owner portal', type: 'bool' },
      { key: 'disable_contacts_editing_in_portal', label: 'Owners cannot edit their contact info in the portal', type: 'bool' },
      { key: 'disable_renter_editing_in_portal', label: 'Owners cannot edit renter info in the portal', type: 'bool' },
    ],
  },
  {
    key: 'budget',
    title: 'Budget variance alerts',
    subtitle: 'Highlight GL lines on budget-vs-actual reports when the variance exceeds these thresholds.',
    fields: [
      { key: 'budget_variance_threshold_amount', label: 'Amount ($)', type: 'money' },
      { key: 'budget_variance_threshold_op', label: 'Combine', type: 'select', options: [{ value: 'and', label: 'And' }, { value: 'or', label: 'Or' }] },
      { key: 'budget_variance_threshold_pct', label: 'Percentage (%)', type: 'percent' },
    ],
  },
  {
    key: 'maintenance',
    title: 'Maintenance',
    fields: [
      { key: 'maintenance_limit', label: 'Approval limit per work order', type: 'money', hint: 'Work above this amount needs manager approval.' },
      { key: 'insurance_expiration', label: 'Building insurance expires', type: 'date' },
      { key: 'maintenance_contact_name', label: 'Maintenance contact', type: 'text' },
      { key: 'maintenance_contact_phone', label: 'Maintenance phone', type: 'text' },
      { key: 'maintenance_contact_email', label: 'Maintenance email', type: 'text' },
      { key: 'home_warranty_covered', label: 'Covered by a home warranty', type: 'bool' },
      { key: 'unit_entry_pre_authorized', label: 'Unit entry pre-authorized for maintenance', type: 'bool' },
      { key: 'disable_online_maintenance_requests', label: 'Disable online maintenance requests', type: 'bool' },
      { key: 'online_maintenance_request_instructions', label: 'Instructions shown on online requests', type: 'textarea', span: 2 },
      { key: 'maintenance_notes', label: 'Maintenance notes', type: 'textarea', span: 2 },
    ],
  },
  {
    key: 'communications',
    title: 'Communications',
    fields: [
      { key: 'violation_sender_name', label: 'Violation notices sent as', type: 'text' },
      { key: 'violation_sender_email_uses_logged_in_user', label: 'Send violation notices from the logged-in manager’s email', type: 'bool' },
      { key: 'violation_sender_email', label: 'Otherwise, send from', type: 'text' },
      { key: 'electronic_doc_delivery_terms', label: 'Terms for electronic document delivery', type: 'textarea', span: 2, hint: 'Shown to owners when they consent to receive documents electronically.' },
    ],
  },
];

export function allSettingKeys() {
  return ASSOCIATION_SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
}

export function monthLabel(n: number | null | undefined) {
  return n ? MONTHS[(Number(n) - 1 + 12) % 12] : '—';
}
export const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));
