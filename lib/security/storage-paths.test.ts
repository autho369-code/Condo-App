import { describe, expect, it } from 'vitest';
import {
  isEntityDocumentStoragePath,
  isScopedStoragePath,
  isSignatureStoragePath,
} from './storage-paths';

describe('private storage path scoping', () => {
  it('accepts only objects below the authorized entity directory', () => {
    expect(isScopedStoragePath('violations/v-1/photo.png', 'violations', 'v-1')).toBe(true);
    expect(isScopedStoragePath('violations/v-2/photo.png', 'violations', 'v-1')).toBe(false);
    expect(isScopedStoragePath('violations/v-1/../v-2/photo.png', 'violations', 'v-1')).toBe(false);
    expect(isScopedStoragePath('violations/v-1/%2e%2e/v-2/photo.png', 'violations', 'v-1')).toBe(false);
    expect(isScopedStoragePath('violations\\v-1\\photo.png', 'violations', 'v-1')).toBe(false);
  });

  it('binds documents to the namespace implied by their RLS-visible row', () => {
    expect(isEntityDocumentStoragePath('associations/a-1/operating/rules.pdf', 'association', 'a-1')).toBe(true);
    expect(isEntityDocumentStoragePath('insurance/o-1/policy.pdf', 'owner', 'o-1')).toBe(true);
    expect(isEntityDocumentStoragePath('insurance/o-2/policy.pdf', 'owner', 'o-1')).toBe(false);
    expect(isEntityDocumentStoragePath('reports/p-1/report.csv', 'association', 'a-1')).toBe(false);
  });

  it('requires canonical signature objects and optionally the expected user', () => {
    expect(isSignatureStoragePath('signatures/user-1/1720000000000.png', 'user-1')).toBe(true);
    expect(isSignatureStoragePath('signatures/user-2/1720000000000.png', 'user-1')).toBe(false);
    expect(isSignatureStoragePath('signatures/user-1/note.html', 'user-1')).toBe(false);
    expect(isSignatureStoragePath('signatures/user-1/sub/1720000000000.png', 'user-1')).toBe(false);
  });
});
