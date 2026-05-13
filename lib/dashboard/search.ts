export type DashboardSearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

export type DashboardSearchGroup = {
  label: string;
  results: DashboardSearchResult[];
};

const ROW_LIMIT = 250;
const GROUP_LIMIT = 5;

export async function buildDashboardSearchGroups(db: any, rawQuery: string): Promise<DashboardSearchGroup[]> {
  const query = rawQuery.trim();
  if (!query) return [];

  const [
    { data: associations },
    { data: units },
    { data: owners },
    { data: vendors },
    { data: workOrders },
    { data: reports },
  ] = await Promise.all([
    db.from('associations')
      .select('id, name, address, city, state')
      .is('archived_at', null)
      .order('name')
      .limit(ROW_LIMIT),
    db.from('units')
      .select('id, unit_number, name, buildings(name, associations(name))')
      .is('archived_at', null)
      .order('unit_number')
      .limit(ROW_LIMIT),
    db.from('owners')
      .select('id, full_name, email, phone')
      .is('archived_at', null)
      .order('full_name')
      .limit(ROW_LIMIT),
    db.from('vendors')
      .select('id, name, trade, email, phone')
      .is('archived_at', null)
      .order('name')
      .limit(ROW_LIMIT),
    db.from('work_orders')
      .select('id, number, title, status, priority, associations(name), units(unit_number)')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT),
    db.from('report_definitions')
      .select('id, slug, name, description, category, active')
      .eq('active', true)
      .order('name')
      .limit(ROW_LIMIT),
  ]);

  return [
    groupResults('Associations', associations, query, (row: any) => ({
      id: `association-${row.id}`,
      type: 'Association',
      title: row.name,
      subtitle: compact([row.address, row.city, row.state]).join(', '),
      href: `/associations/${row.id}`,
      searchable: [row.name, row.address, row.city, row.state],
    })),
    groupResults('Units', units, query, (row: any) => {
      const building = asOne(row.buildings);
      const association = asOne(building?.associations);
      return {
        id: `unit-${row.id}`,
        type: 'Unit',
        title: `Unit ${row.unit_number}`,
        subtitle: compact([association?.name, building?.name, row.name]).join(' / '),
        href: `/units/${row.id}`,
        searchable: [row.unit_number, row.name, building?.name, association?.name],
      };
    }),
    groupResults('Owners', owners, query, (row: any) => ({
      id: `owner-${row.id}`,
      type: 'Owner',
      title: row.full_name,
      subtitle: compact([row.email, row.phone]).join(' / '),
      href: `/owners/${row.id}`,
      searchable: [row.full_name, row.email, row.phone],
    })),
    groupResults('Vendors', vendors, query, (row: any) => ({
      id: `vendor-${row.id}`,
      type: 'Vendor',
      title: row.name,
      subtitle: compact([row.trade, row.email, row.phone]).join(' / '),
      href: `/vendors?q=${encodeURIComponent(row.name ?? '')}`,
      searchable: [row.name, row.trade, row.email, row.phone],
    })),
    groupResults('Work Orders', workOrders, query, (row: any) => {
      const association = asOne(row.associations);
      const unit = asOne(row.units);
      return {
        id: `work-order-${row.id}`,
        type: 'Work order',
        title: row.title ?? `Work order ${row.number ?? ''}`.trim(),
        subtitle: compact([row.number ? `#${row.number}` : null, row.status, association?.name, unit?.unit_number ? `Unit ${unit.unit_number}` : null]).join(' / '),
        href: `/work-orders/${row.id}`,
        searchable: [row.title, row.number, row.status, row.priority, association?.name, unit?.unit_number],
      };
    }),
    groupResults('Reports', reports, query, (row: any) => ({
      id: `report-${row.id}`,
      type: 'Report',
      title: row.name,
      subtitle: compact([row.category, row.description]).join(' / '),
      href: `/reports/${row.slug}`,
      searchable: [row.name, row.slug, row.category, row.description],
    })),
  ].filter((group) => group.results.length > 0);
}

function groupResults(
  label: string,
  rows: unknown[] | null | undefined,
  query: string,
  mapRow: (row: any) => DashboardSearchResult & { searchable: unknown[] },
): DashboardSearchGroup {
  const results = (rows ?? [])
    .map(mapRow)
    .filter((row) => matches(row.searchable, query))
    .slice(0, GROUP_LIMIT)
    .map(({ searchable: _searchable, ...row }) => row);

  return { label, results };
}

function matches(values: unknown[], query: string) {
  const needle = normalize(query);
  return values.some((value) => normalize(value).includes(needle));
}

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function compact(values: unknown[]) {
  return values.map((value) => String(value ?? '').trim()).filter(Boolean);
}

function asOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}
