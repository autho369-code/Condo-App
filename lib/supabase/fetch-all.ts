// PostgREST returns at most 1,000 rows per request. For listings that must be
// complete (a general ledger, a reconciliation), page through with .range().
// `build` must return a fresh query with a deterministic order (end the order
// with a unique column such as id) on every call.
export async function fetchAllRows<T = any>(
  build: () => any,
  { pageSize = 1000, maxRows = 50000 }: { pageSize?: number; maxRows?: number } = {},
): Promise<{ rows: T[]; truncated: boolean; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build().range(from, Math.min(from + pageSize, maxRows) - 1);
    if (error) return { rows, truncated: false, error: error.message ?? String(error) };
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return { rows, truncated: false, error: null };
  }
  return { rows, truncated: true, error: null };
}
