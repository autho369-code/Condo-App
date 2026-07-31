import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('association document storage', () => {
  const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260731004000_ensure_private_association_documents_bucket.sql'),
    'utf8',
  );

  it('provisions a private, bounded document bucket in every environment', () => {
    expect(migration).toContain("'association-documents'");
    expect(migration).toMatch(/public,\s*file_size_limit,\s*allowed_mime_types/);
    expect(migration).toContain('26214400');
    expect(migration).toContain("'application/pdf'");
    expect(migration).toContain("'image/jpeg'");
    expect(migration).toContain('on conflict (id) do update');
  });

  it('does not create a client storage policy for service-authorized workflows', () => {
    expect(migration).not.toMatch(/create\s+policy/i);
    expect(migration).not.toContain("'application/x-msdownload'");
  });
});
