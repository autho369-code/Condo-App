// Search across several columns or related records without first collecting
// candidate ids (an id lookup has to be capped, which silently drops matches,
// and a long id list overflows the request URL). Each branch is a complete,
// filtered, ordered and limited query for one way a row can match; the
// branches run in parallel and their rows are merged by id.
export async function unionSearch<T extends { id: string }>(
  branches: Array<PromiseLike<{ data: T[] | null; error: { message?: string } | null }>>,
  compare: (a: T, b: T) => number,
  limit: number,
): Promise<{ rows: T[]; error: string | null }> {
  const results = await Promise.all(branches);
  const failed = results.find((r) => r.error);
  if (failed) return { rows: [], error: failed.error?.message ?? 'Search failed' };
  const byId = new Map<string, T>();
  for (const r of results) for (const row of r.data ?? []) if (!byId.has(row.id)) byId.set(row.id, row);
  return { rows: [...byId.values()].sort(compare).slice(0, limit), error: null };
}

/** Descending comparison of nullable ISO dates/timestamps; nulls sort last. */
export function descNullsLast(a: string | null | undefined, b: string | null | undefined): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : -1;
}
