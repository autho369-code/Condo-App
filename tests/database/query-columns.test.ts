import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findQueryColumnProblems, selectProblems } from '../../scripts/lib/query-columns.mjs';

const schema = JSON.parse(readFileSync(join(process.cwd(), 'supabase/schema-columns.json'), 'utf8'));

describe('query columns', () => {
  it('every static select names columns the database has', () => {
    const { problems, checked } = findQueryColumnProblems(process.cwd(), schema);
    expect(checked).toBeGreaterThan(1000);
    // A failure lists file:line and the missing column. If the column was added
    // by a new migration, refresh supabase/schema-columns.json (SQL in
    // scripts/lib/query-columns.mjs).
    expect(problems).toEqual([]);
  });

  it('catches a column the table does not have', () => {
    expect(selectProblems(schema, 'portfolios', 'company_name, name')).toEqual(['portfolios.name does not exist']);
  });

  it('checks embedded tables and accepts aliases, casts, json paths, counts and FK-column embeds', () => {
    expect(selectProblems(schema, 'user_invitations', 'portfolio_id, portfolios(company_name)')).toEqual([]);
    expect(selectProblems(schema, 'user_invitations', 'portfolios(company_name, name)')).toEqual(['portfolios.name does not exist']);
    expect(selectProblems(schema, 'occupancies', 'id, owner:owners!owner_id(full_name), created_at::text')).toEqual([]);
    expect(selectProblems(schema, 'dues_increases', 'id, dues_increase_lines(count)')).toEqual([]);
    expect(selectProblems(schema, 'service_requests', 'id, tenant_id(first_name)')).toEqual([]);
    expect(selectProblems(schema, 'no_such_table', 'id')).toEqual(["table or view 'no_such_table' not found"]);
  });
});
