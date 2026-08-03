import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260802020000_association_operating_document_types.sql',
  'utf8',
).toLowerCase();
const page = readFileSync('app/(app)/associations/[id]/documents/page.tsx', 'utf8');

describe('association operating documents', () => {
  it('allows every document type emitted by the association upload form', () => {
    for (const type of [
      'declaration_ccrs',
      'bylaws',
      'articles_of_incorporation',
      'rules_regulations',
      'operating_budget',
      'master_insurance_policy',
      'association_document',
    ]) {
      expect(migration).toContain(`'${type}'::text`);
    }
  });

  it('recovers only scoped orphaned operating-document objects', () => {
    expect(migration).toContain("o.bucket_id = 'association-documents'");
    expect(migration).toContain("'^associations/[0-9a-fa-f-]{36}/operating/");
    expect(migration).toContain('join public.associations association');
    expect(migration).toContain('existing.file_url = orphan.file_url');
  });

  it('removes the storage object when metadata persistence fails', () => {
    expect(page).toContain("new Set<string>([...OPERATING_TYPES, 'association_document'])");
    expect(page).toContain('await svc.storage.from(BUCKET).remove([path])');
    expect(page).toContain('Could not save document record:');
  });
});
