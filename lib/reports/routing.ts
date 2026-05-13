export function canonicalReportSlug(value: string) {
  const normalized = value.trim().toLowerCase().replace(/-/g, '_');
  return reportSlugAliases[normalized] ?? normalized;
}

export function reportHrefFromSlugParam(value: string | undefined | null) {
  if (!value?.trim()) return null;
  return `/reports/${canonicalReportSlug(value)}`;
}

export function withReportError(returnTo: string, message: string) {
  const [path, query = ''] = returnTo.split('?');
  const params = new URLSearchParams(query);
  params.set('error', message);
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

const reportSlugAliases: Record<string, string> = {
  annual_budget_approved: 'annual_budget_comparative',
  annual_budget_comparison: 'annual_budget_comparative',
  activities_summary: 'association_log',
  association_summary: 'association_log',
  budget_components: 'budget_vs_actual',
  budget_detail: 'budget_vs_actual',
  budget_property_comparison: 'balance_sheet_association_comparison',
  balance_sheet_property_comparison: 'balance_sheet_association_comparison',
  cash_flow_property_comparison: 'cash_flow_association_comparison',
  income_statement_property_comparison: 'income_statement_association_comparison',
  property_directory: 'association_directory',
  property_inspection: 'association_inspection',
  trial_balance_property: 'trial_balance_association',
  homeowner_balance: 'owner_balance',
  homeowner_delinquency: 'delinquency',
  homeowner_directory: 'owner_directory',
  homeowner_ledger: 'owner_ledger',
  homeowner_prepaid: 'owner_prepaid',
  homeowner_vehicle_info: 'owner_vehicle_info',
  homeowner_violations: 'owner_violations',
  owner_statement: 'owner_ledger',
  owner_statement_enhanced: 'owner_ledger',
  renter_directory: 'unit_directory',
  tenant_directory: 'unit_directory',
  vendor_1099: 'vendor_1099_summary',
};
