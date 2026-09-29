import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { folderForDocType, orderedFolders, SHARE_SCOPES } from '@/lib/associations/document-sharing';

describe('document folders', () => {
  it('files operating documents into standard folders', () => {
    expect(folderForDocType('bylaws')).toBe('Governing documents');
    expect(folderForDocType('master_insurance_policy')).toBe('Insurance');
    expect(folderForDocType('association_document')).toBeNull();
  });

  it('orders default folders first, then custom ones alphabetically', () => {
    expect(orderedFolders(['Zoning', 'Financial', null, 'Contracts', 'Arbitration', 'Financial'])).toEqual(['Financial', 'Contracts', 'Arbitration', 'Zoning']);
  });
});

describe('document sharing migration', () => {
  const sql = readFileSync('supabase/migrations/20260929190000_association_document_folders_sharing.sql', 'utf8');

  it('keeps the database scopes in sync with the UI', () => {
    expect(sql).toContain(`check (share_scope in (${SHARE_SCOPES.map((s) => `'${s}'`).join(', ')}))`);
  });

  it('gates owner, tenant and board reads on share_scope', () => {
    const policy = (name: string) => sql.split(`create policy ${name}`)[1]?.split(');')[0] ?? '';
    expect(policy('documents_resident_tenant_read')).toContain("entity_type = 'association' and share_scope = 'owners'");
    expect(policy('documents_tenant_read')).toContain("share_scope = 'owners'");
    expect(policy('documents_board_association_read')).toContain("share_scope in ('board', 'owners')");
  });

  it('forces generated owner letters to management-only', () => {
    expect(sql).toMatch(/generated\/%' and tg_op = 'INSERT' then\s+new\.share_scope := 'staff'/);
  });

  it('authorizes edits and deletes inside the RPCs', () => {
    for (const fn of ['update_association_document', 'delete_association_document']) {
      const body = sql.split(`create or replace function public.${fn}(`)[1]?.split('end $$;')[0] ?? '';
      expect(body, fn).toContain('can_manage_association(d.entity_id)');
      expect(body, fn).toContain('audit_logs');
    }
  });
});
