export type ReportDefinition = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description?: string | null;
  active?: boolean;
};

const categoryLabels: Record<string, string> = {
  accounting: 'Accounting',
  association: 'Association',
  compliance: 'Compliance',
  maintenance: 'Maintenance',
  people: 'People',
  property_unit: 'Association And Unit',
  communication: 'Communication',
};

const blockedReportTerms = /\blease|leasing\b/i;

export function groupReports(definitions: ReportDefinition[]) {
  const grouped = new Map<string, ReportDefinition[]>();

  for (const definition of normalizeReportDefinitions(definitions).filter((row) => row.active !== false)) {
    const current = grouped.get(definition.category) ?? [];
    grouped.set(definition.category, [...current, definition]);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => (categoryLabels[a] ?? a).localeCompare(categoryLabels[b] ?? b))
    .map(([category, items]) => ({
      category,
      title: categoryLabels[category] ?? category,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export type ReportScopeInput = {
  scope: 'portfolio' | 'association' | 'owner' | 'unit';
  associationId?: string;
  ownerId?: string;
  unitId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function serializeReportParams(input: ReportScopeInput) {
  const params: Record<string, string> = { scope: input.scope };
  if (input.associationId) params.association_id = input.associationId;
  if (input.ownerId) params.owner_id = input.ownerId;
  if (input.unitId) params.unit_id = input.unitId;
  if (input.dateFrom) params.date_from = input.dateFrom;
  if (input.dateTo) params.date_to = input.dateTo;
  return params;
}

export function filterReports(definitions: ReportDefinition[], query: string) {
  const normalizedDefinitions = normalizeReportDefinitions(definitions);
  const term = query.trim().toLowerCase();
  if (!term) return normalizedDefinitions;
  return normalizedDefinitions.filter((definition) =>
    definition.name.toLowerCase().includes(term) ||
    definition.slug.toLowerCase().includes(term) ||
    (definition.description ?? '').toLowerCase().includes(term) ||
    (categoryLabels[definition.category] ?? definition.category).toLowerCase().includes(term)
  );
}

export function normalizeReportDefinitions(definitions: ReportDefinition[]) {
  return definitions
    .filter((definition) => !blockedReportTerms.test(`${definition.slug} ${definition.name} ${definition.description ?? ''}`))
    .map((definition) => ({
      ...definition,
      name: reportDisplayText(definition.name),
      description: definition.description ? reportDisplayText(definition.description) : definition.description,
    }));
}

export function reportDisplayText(value: string) {
  return value
    .replace(/\bHomeowners\b/g, 'Owners')
    .replace(/\bhomeowners\b/g, 'owners')
    .replace(/\bHomeowner\b/g, 'Owner')
    .replace(/\bhomeowner\b/g, 'owner')
    .replace(/\bProperties\b/g, 'Associations')
    .replace(/\bproperties\b/g, 'associations')
    .replace(/\bProperty\b/g, 'Association')
    .replace(/\bproperty\b/g, 'association')
    .replace(/\bTenants\b/g, 'Renters')
    .replace(/\btenants\b/g, 'renters')
    .replace(/\bTenant\b/g, 'Renter')
    .replace(/\btenant\b/g, 'renter');
}

export { categoryLabels };
