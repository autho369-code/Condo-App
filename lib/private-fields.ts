// Staff-only columns live in <table>_private side tables (RLS: staff only;
// see supabase/migrations/20261004200000_staff_private_notes.sql). Parent
// rows that owners, tenants, board members or vendors can read never carry
// them: a trigger moves any value written to the parent column. Staff pages
// merge the side-table values back onto the rows they display.

type Db = any;
type Row = Record<string, any>;

const CHUNK = 200;
const PARALLEL = 6;

/**
 * Copy `columns` from `privateTable` onto each row (matched on `key` =
 * row[idField]). Missing private rows give null. Mutates and returns `rows`.
 * Read failures leave the fields null rather than breaking the page.
 */
export async function mergePrivateFields<T extends Row>(
  db: Db,
  privateTable: string,
  key: string,
  columns: readonly string[],
  rows: T[],
  idField = 'id',
): Promise<T[]> {
  const ids = [...new Set(rows.map((r) => r?.[idField]).filter((v): v is string => typeof v === 'string' && v.length > 0))];
  const byId = new Map<string, Row>();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  // A few requests at a time: long registers can hold thousands of rows.
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const results = await Promise.all(chunks.slice(i, i + PARALLEL).map((chunk) =>
      db.from(privateTable).select([key, ...columns].join(', ')).in(key, chunk)));
    for (const { data } of results) for (const p of (data ?? []) as Row[]) byId.set(p[key], p);
  }
  for (const r of rows) {
    if (!r) continue;
    const p = byId.get(r[idField]);
    for (const c of columns) (r as Row)[c] = p?.[c] ?? null;
  }
  return rows;
}

/** Single-row form of mergePrivateFields. Returns the row (or null). */
export async function mergePrivateFieldsOne<T extends Row>(
  db: Db,
  privateTable: string,
  key: string,
  columns: readonly string[],
  row: T | null | undefined,
  idField = 'id',
): Promise<T | null> {
  if (!row) return null;
  await mergePrivateFields(db, privateTable, key, columns, [row], idField);
  return row;
}

/**
 * Write staff-only values straight to the side table (authoritative: null
 * clears). Use where a form can clear a value — writing NULL to the parent
 * column leaves the stored value alone. Returns the Supabase error, if any.
 */
export async function savePrivateFields(
  db: Db,
  privateTable: string,
  key: string,
  id: string,
  values: Record<string, string | null>,
): Promise<{ message: string } | null> {
  const clean: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(values)) clean[k] = typeof v === 'string' && v.trim() ? v.trim() : null;
  const { error } = await db.from(privateTable).upsert(
    { [key]: id, ...clean, updated_at: new Date().toISOString() },
    { onConflict: key },
  );
  return error ?? null;
}
