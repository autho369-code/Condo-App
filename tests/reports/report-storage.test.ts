import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('report output storage', () => {
  it('provisions a private, bounded reports bucket for every environment', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260731003000_ensure_private_report_outputs_bucket.sql'),
      'utf8',
    );

    expect(migration).toContain("'reports'");
    expect(migration).toMatch(/public,\s*file_size_limit,\s*allowed_mime_types/);
    expect(migration).toContain('false');
    expect(migration).toContain("'application/pdf'");
    expect(migration).toContain("'text/csv'");
    expect(migration).toContain("'application/json'");
    expect(migration).toContain('on conflict (id) do update');
  });

  it('fails the run honestly when signing does not return a usable URL', () => {
    const processor = readFileSync(resolve(process.cwd(), 'lib/reports/process.ts'), 'utf8');

    expect(processor).toContain('error: signErr');
    expect(processor).toContain("status: 'failed'");
    expect(processor).toContain('Output signing failed:');
  });
});
