// ─────────────────────────────────────────────────────────────────────────
// User-defined Report Builder — CURATED catalog.
//
// SECURITY: This builder never executes arbitrary SQL. It exposes a fixed set
// of data sources, each with a WHITELISTED set of display columns. The page and
// the CSV export route both build the query through the Supabase client
// (`.from(table).select(cols).eq(...)`), so:
//   - Only whitelisted columns are ever selected (anything else is dropped).
//   - Only known tables/views are queried.
//   - RLS still applies — results are automatically scoped to the manager's
//     portfolio / associations. There is no string interpolation into SQL.
// ─────────────────────────────────────────────────────────────────────────

export type BuilderColumn = { key: string; label: string };

export type BuilderSource = {
  /** stable key used in the querystring (?source=) and saved_report_views.source_key */
  key: string;
  /** human label shown in the source picker */
  label: string;
  /** real table or view name (verified against information_schema) */
  table: string;
  /** whitelisted display columns — only existing columns */
  columns: BuilderColumn[];
  /** true when the table has an `association_id` column we can filter on */
  filterableAssociation: boolean;
  /** existing date column for the from/to range filter, if any */
  dateColumn?: string;
  /** existing status/enum column for the status filter, if any */
  statusColumn?: string;
};

// Columns below were verified to exist via information_schema on
// project termxngysvotnfbzbgrv (2026-06-22).
export const BUILDER_SOURCES: BuilderSource[] = [
  {
    key: 'owners',
    label: 'Owners',
    table: 'owners',
    columns: [
      { key: 'full_name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'mailing_address', label: 'Mailing address' },
      { key: 'portal_activated', label: 'Portal activated' },
      { key: 'created_at', label: 'Created' },
    ],
    filterableAssociation: false, // owners has no association_id (portfolio-scoped via RLS)
    dateColumn: 'created_at',
  },
  {
    key: 'units',
    label: 'Units',
    table: 'units',
    columns: [
      { key: 'unit_number', label: 'Unit #' },
      { key: 'name', label: 'Name' },
      { key: 'sqft', label: 'Sq ft' },
      { key: 'bedrooms', label: 'Bedrooms' },
      { key: 'bathrooms', label: 'Bathrooms' },
      { key: 'ownership_pct', label: 'Ownership %' },
    ],
    filterableAssociation: false, // units link to association via building_id, not directly
  },
  {
    key: 'work_orders',
    label: 'Work Orders',
    table: 'work_orders',
    columns: [
      { key: 'number', label: 'WO #' },
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'scheduled_date', label: 'Scheduled' },
      { key: 'completed_date', label: 'Completed' },
    ],
    filterableAssociation: true,
    dateColumn: 'scheduled_date',
    statusColumn: 'status',
  },
  {
    key: 'violations',
    label: 'Violations',
    table: 'violations',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status' },
      { key: 'date_observed', label: 'Date observed' },
      { key: 'fine_amount', label: 'Fine amount' },
      { key: 'cure_deadline', label: 'Cure deadline' },
      { key: 'created_at', label: 'Created' },
    ],
    filterableAssociation: true,
    dateColumn: 'date_observed',
    statusColumn: 'status',
  },
  {
    key: 'charges',
    label: 'Charges',
    table: 'charges',
    columns: [
      { key: 'description', label: 'Description' },
      { key: 'charge_type', label: 'Type' },
      { key: 'amount', label: 'Amount' },
      { key: 'due_date', label: 'Due date' },
      { key: 'created_at', label: 'Created' },
    ],
    filterableAssociation: false, // charges link to association via unit_id
    dateColumn: 'due_date',
    statusColumn: 'charge_type',
  },
  {
    key: 'payments',
    label: 'Payments',
    table: 'payments',
    columns: [
      { key: 'amount', label: 'Amount' },
      { key: 'payment_date', label: 'Payment date' },
      { key: 'method', label: 'Method' },
      { key: 'reference', label: 'Reference' },
      { key: 'created_at', label: 'Created' },
    ],
    filterableAssociation: false, // payments link to association via unit_id
    dateColumn: 'payment_date',
    statusColumn: 'method',
  },
  {
    key: 'vendors',
    label: 'Vendors',
    table: 'vendors',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'vendor_type', label: 'Vendor type' },
      { key: 'trade', label: 'Trade' },
      { key: 'payment_terms', label: 'Payment terms' },
      { key: 'portal_activated', label: 'Portal activated' },
      { key: 'created_at', label: 'Created' },
    ],
    filterableAssociation: false, // vendors are portfolio-scoped (no association_id)
    statusColumn: 'vendor_type',
    dateColumn: 'created_at',
  },
];

export function getSource(sourceKey: string | undefined | null): BuilderSource | undefined {
  if (!sourceKey) return undefined;
  return BUILDER_SOURCES.find((s) => s.key === sourceKey);
}

/** Intersect requested column keys with the source whitelist (order = catalog order). */
export function validColumns(source: BuilderSource, requested: string[] | undefined): BuilderColumn[] {
  if (!requested || requested.length === 0) return source.columns;
  const set = new Set(requested);
  const picked = source.columns.filter((c) => set.has(c.key));
  return picked.length > 0 ? picked : source.columns;
}

export type BuilderFilters = {
  association?: string;
  status?: string;
  from?: string;
  to?: string;
};

export type BuilderRequest = {
  source: BuilderSource;
  columns: BuilderColumn[];
  filters: BuilderFilters;
};

/**
 * Parse a querystring (or saved filters) into a validated request, or null if
 * the source is unknown. Column keys are intersected against the whitelist.
 */
export function parseBuilderRequest(params: {
  source?: string;
  cols?: string | string[];
  association?: string;
  status?: string;
  from?: string;
  to?: string;
}): BuilderRequest | null {
  const source = getSource(params.source);
  if (!source) return null;

  const requestedCols = Array.isArray(params.cols)
    ? params.cols
    : typeof params.cols === 'string' && params.cols.length > 0
      ? params.cols.split(',')
      : undefined;

  const columns = validColumns(source, requestedCols);

  const filters: BuilderFilters = {};
  if (source.filterableAssociation && params.association) filters.association = params.association;
  if (source.statusColumn && params.status) filters.status = params.status;
  if (source.dateColumn && params.from) filters.from = params.from;
  if (source.dateColumn && params.to) filters.to = params.to;

  return { source, columns, filters };
}

/** The awaited shape of a supabase query (the bits we read). */
export type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
};

/**
 * A minimal subset of the supabase query-builder surface we rely on. It is
 * also a thenable that resolves to a QueryResult, so callers can `await` it.
 */
type QueryBuilder = PromiseLike<QueryResult> & {
  select: (cols: string) => QueryBuilder;
  eq: (col: string, val: unknown) => QueryBuilder;
  gte: (col: string, val: unknown) => QueryBuilder;
  lte: (col: string, val: unknown) => QueryBuilder;
  limit: (n: number) => QueryBuilder;
};

/**
 * Build (but do not await) the whitelisted, RLS-scoped query.
 * Shared by the builder page and the CSV export route so both apply the exact
 * same validation and filters.
 */
export function buildBuilderQuery(
  supabase: { from: (table: string) => QueryBuilder },
  req: BuilderRequest,
  limit = 500,
): QueryBuilder {
  const { source, columns, filters } = req;
  const cols = columns.map((c) => c.key).join(',');

  let query = supabase.from(source.table).select(cols);

  if (source.filterableAssociation && filters.association) {
    query = query.eq('association_id', filters.association);
  }
  if (source.statusColumn && filters.status) {
    query = query.eq(source.statusColumn, filters.status);
  }
  if (source.dateColumn && filters.from) {
    query = query.gte(source.dateColumn, filters.from);
  }
  if (source.dateColumn && filters.to) {
    query = query.lte(source.dateColumn, filters.to);
  }

  return query.limit(limit);
}

/** Reconstruct a shareable querystring from a request (used by saved views & export links). */
export function toBuilderQueryString(req: BuilderRequest): string {
  const sp = new URLSearchParams();
  sp.set('source', req.source.key);
  sp.set('cols', req.columns.map((c) => c.key).join(','));
  if (req.filters.association) sp.set('association', req.filters.association);
  if (req.filters.status) sp.set('status', req.filters.status);
  if (req.filters.from) sp.set('from', req.filters.from);
  if (req.filters.to) sp.set('to', req.filters.to);
  return sp.toString();
}

/** Format a single cell value for table/CSV display. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Serialize rows to CSV using the curated column labels as headers. */
export function rowsToCsv(columns: BuilderColumn[], rows: Record<string, unknown>[]): string {
  const escape = (s: string) => {
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escape(formatCell(row[c.key]))).join(','),
  );
  return [header, ...body].join('\r\n');
}
