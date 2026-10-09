import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Supabase runs pg_safeupdate for API sessions: a DELETE with no WHERE clause
// fails, even inside a security definer RPC. Migration 20261009090000 clears
// the three per-call temp tables with TRUNCATE instead.

const dir = resolve(process.cwd(), 'supabase/migrations');
const FIX = '20261009090000_clear_temp_tables_with_truncate.sql';
// Also catches `only x`, quoted names and an alias, still with no WHERE.
const bareDelete = /\bdelete\s+from\s+(only\s+)?[a-z_."]+(\s+(as\s+)?[a-z_]+)?\s*;/i;

describe('temp tables are cleared without a bare DELETE', () => {
  const sql = readFileSync(resolve(dir, FIX), 'utf8');

  it('patches exactly the three functions and keeps their grants', () => {
    for (const f of [
      "'public.import_journal_entry_batch(text, jsonb)|_je_rows'",
      "'public.import_bills(jsonb)|_bill_rows'",
      "'public.app_scan_unapplied_credits(uuid)|_unapplied_now'",
    ]) expect(sql).toContain(f);
    expect(sql).toContain("v_new := 'truncate ' || split_part(f, '|', 2) || ';';");
    expect(sql).toContain('if n <> 1 then raise exception');
    // Re-runnable: a function already patched is skipped.
    expect(sql).toContain('if n = 0 and position(v_new in v_def) > 0 then continue; end if;');
    expect(sql).not.toMatch(/delete from|drop |revoke |grant /i);
    // eslint-disable-next-line no-control-regex
    expect(sql).not.toMatch(/[^\x00-\x7f]/);
  });

  it('adds no new bare DELETE in a later migration', () => {
    const later = readdirSync(dir).filter((f) => f.endsWith('.sql') && f > FIX);
    for (const f of later) expect(readFileSync(resolve(dir, f), 'utf8'), f).not.toMatch(bareDelete);
  });
});
