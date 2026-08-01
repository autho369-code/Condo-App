import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const seed = readFileSync(join(root, 'scripts', 'seed-staging-verification.mjs'), 'utf8');
const cleanup = readFileSync(join(root, 'scripts', 'cleanup-staging-verification.mjs'), 'utf8');
const seedEntrypoint = readFileSync(join(root, 'scripts', 'seed-codex-test-data.mjs'), 'utf8');
const cleanupEntrypoint = readFileSync(join(root, 'scripts', 'cleanup-codex-test-data.mjs'), 'utf8');

describe('CODEX_TEST staging fixture safety', () => {
  it('provides the required canonical seed and cleanup entrypoints', () => {
    expect(seedEntrypoint).toContain("import('./seed-staging-verification.mjs')");
    expect(cleanupEntrypoint).toContain("import('./cleanup-staging-verification.mjs')");
  });

  it('fails closed for production and requires explicit staging confirmation', () => {
    for (const source of [seed, cleanup]) {
      expect(source).toContain("const STAGING_REF = 'zalfkrtjeswvfmucicea'");
      expect(source).toContain("const PRODUCTION_REF = 'termxngysvotnfbzbgrv'");
      expect(source).toContain('process.env.PORTIER369_STAGING_CONFIRM !== STAGING_REF');
    }
    expect(cleanup).toContain('PORTIER369_CODEX_TEST_CLEANUP_CONFIRM');
    expect(cleanup).toContain('Fixture ownership check failed; no rows were deleted');
  });

  it('seeds every supported verification domain with deterministic IDs', () => {
    for (const table of [
      'portfolios', 'associations', 'buildings', 'units', 'owners', 'tenants', 'vendors',
      'charges', 'payments', 'bank_transactions', 'work_orders', 'maintenance_tasks',
      'violations', 'documents', 'communication_messages', 'communications_log', 'calendar_events', 'meetings',
      'insurance_policies', 'payable_bills', 'journal_entries', 'journal_lines',
      'bank_reconciliation_items',
    ]) {
      expect(seed).toContain(`upsert('${table}'`);
    }
    expect(seed).toContain('expected: { alphaTrialBalanceDebits: 21000');
    expect(seed).not.toContain("output_formats: ['pdf', 'xlsx'");
  });

  it('cleans keyed and derivative fixture records through their real columns', () => {
    expect(cleanup).toContain("from('board_approval_settings').delete().in('association_id', associationIds)");
    expect(cleanup).toContain("from('audit_logs').delete().in('actor_id', fixtureUsers.map((user) => user.id))");
    expect(cleanup).toContain("from('email_queue').delete().in('portfolio_id', portfolioIds)");
    expect(cleanup).toContain("removeByIds('profiles', fixtureUsers.map((user) => user.id))");
    expect(cleanup).toContain("removeByIds('communications_log'");
  });
});
