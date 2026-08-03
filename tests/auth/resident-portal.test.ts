import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = readFileSync(
  join(root, 'supabase/migrations/20260803050000_resident_portal_access.sql'),
  'utf8',
).toLowerCase();

const residentSources = [
  'app/resident/page.tsx',
  'app/resident/actions.ts',
  'app/resident/requests/page.tsx',
  'app/resident/work-orders/page.tsx',
  'app/resident/calendar/page.tsx',
  'app/resident/documents/page.tsx',
  'app/resident/communications/page.tsx',
  'app/resident/meetings/page.tsx',
  'app/resident/profile/page.tsx',
  'components/resident/insurance-upload-form.tsx',
].map((file) => readFileSync(join(root, file), 'utf8')).join('\n').toLowerCase();
const inviteSource = readFileSync(join(root, 'app/invite/page.tsx'), 'utf8').toLowerCase();

describe('resident portal boundary', () => {
  it('uses a strong tenant identity link and separate tenant scopes', () => {
    expect(migration).toContain('add column if not exists auth_user_id uuid references auth.users(id)');
    expect(migration).toContain('create or replace function public.current_tenant_unit_ids()');
    expect(migration).toContain('create or replace function public.current_tenant_association_ids()');
    expect(migration).toContain("p.hoa_role = 'tenant'");
    expect(migration).toContain("p.hoa_role = 'vendor'");
    expect(migration).toContain('and t.auth_user_id = auth.uid()');
    expect(migration).toContain('and t.portal_activated');
    expect(migration).toContain("new.raw_user_meta_data ->> 'invitation_id'");
    expect(migration).toContain('if v_invitation_id is null then');
    expect(migration).not.toContain('Backward-compatible path for legacy Auth provisioning');
    expect(inviteSource).toContain('invitation_id: invite.id');
  });

  it('routes resident mutations through narrow security-definer RPCs', () => {
    expect(migration).toContain('create or replace function public.submit_tenant_service_request(');
    expect(migration).toContain('create or replace function public.cancel_tenant_service_request(');
    expect(migration).toContain('create or replace function public.update_tenant_portal_profile(');
    expect(migration).toContain('create or replace function public.submit_tenant_message(');
    expect(migration).toContain("revoke all on function public.submit_tenant_service_request");
  });

  it('does not add tenant policies to owner financial tables', () => {
    for (const table of ['charges', 'payments', 'statements', 'autopay_mandates', 'violations', 'ballots']) {
      expect(migration).not.toMatch(new RegExp(`create\\s+policy[^;]+tenant[^;]+on\\s+public\\.${table}`));
    }
    expect(residentSources).not.toMatch(/\.from\(['"](?:charges|payments|statements|autopay_mandates|violations|ballots)['"]\)/);
    expect(residentSources).not.toContain('/portal/ledger');
    expect(residentSources).not.toContain('/portal/pay');
  });

  it('includes the complete nonfinancial resident workflow', () => {
    expect(residentSources).toContain("rpc('submit_tenant_service_request'");
    expect(residentSources).toContain("rpc('cancel_tenant_service_request'");
    expect(residentSources).toContain("rpc('submit_tenant_message'");
    expect(residentSources).toContain('uploadtosignedurl');
    expect(residentSources).toContain("from('documents')");
    expect(residentSources).toContain("from('calendar_events')");
    expect(residentSources).toContain("from('meetings')");
  });
});
