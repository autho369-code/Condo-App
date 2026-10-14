import { fetchAllRows } from '@/lib/supabase/fetch-all';

// A long .in() list makes the request URL too long, and one request stops at
// 1,000 rows. Look the ids up a chunk at a time, paging each chunk. `build`
// gets one chunk and must return a fresh query ordered by a unique column.
export async function selectInChunks<T = any>(
  ids: Array<string | null | undefined>,
  build: (chunk: string[]) => any,
  { chunkSize = 200 }: { chunkSize?: number } = {},
): Promise<{ rows: T[]; error: string | null }> {
  const unique = [...new Set(ids.filter((v): v is string => typeof v === 'string' && v.length > 0))];
  const rows: T[] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const res = await fetchAllRows<T>(() => build(chunk));
    if (res.error) return { rows, error: res.error };
    if (res.truncated) return { rows, error: 'Too many rows to load' };
    rows.push(...res.rows);
  }
  return { rows, error: null };
}
