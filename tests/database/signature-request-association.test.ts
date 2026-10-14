import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261015120000_signature_request_association.sql'),
  'utf8',
).replace(/\r\n/g, '\n');

describe('20261015120000_signature_request_association migration', () => {
  it('files a linked request under the linked record association when none is sent', () => {
    expect(migration).toContain('coalesce(p_association_id, v_subject_association)');
  });

  it('refuses a linked record of an archived association', () => {
    expect(migration).toContain('a.id = v_subject_association and a.archived_at is null');
    expect(migration).toContain('belongs to an archived association');
  });

  it('is re-runnable and the anchor must appear exactly once', () => {
    expect(migration).toContain("position('signature_request_association' in d) > 0 then return");
    expect(migration).toContain('anchor not found exactly once');
  });

  it('drops or deletes nothing', () => {
    expect(migration).not.toMatch(/\bdrop\s+(table|column|view|function|policy)\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
  });
});
