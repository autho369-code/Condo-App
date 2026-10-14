import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const redirects: string[] = [];
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { redirects.push(url); throw new Error(`REDIRECT ${url}`); },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const staff = { auth_user_id: 'staff-1', is_staff: true, is_company_admin: false, is_platform_operator: false, owner_ids: [], profile: { full_name: 'Sam Staff' }, email: 's@example.com' };
const requireStaff = vi.fn(async () => staff);
const requireOwner = vi.fn(async () => ({ ...staff, is_staff: false, owner_ids: ['owner-1'] }));
vi.mock('@/lib/auth/me', () => ({
  requireStaff: () => requireStaff(),
  requireOwner: () => requireOwner(),
  getMe: vi.fn(),
}));

// A chainable stand-in for the Supabase update/insert builders.
const updates: Array<Record<string, unknown>> = [];
const inserts: Array<Record<string, unknown>> = [];
let updateResult: { data: unknown; error: unknown } = { data: [{ id: 'r' }], error: null };
function builder() {
  const b: any = {
    update: (patch: Record<string, unknown>) => { updates.push(patch); return b; },
    insert: (row: Record<string, unknown>) => { inserts.push(row); return Promise.resolve({ error: null }); },
    eq: () => b,
    in: () => b,
    select: () => Promise.resolve(updateResult),
  };
  return b;
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => builder() }),
  createServiceClient: () => ({}),
}));
const notify = vi.fn(async () => true);
vi.mock('@/lib/notifications/status-change', () => ({ notifyOwnerOfStatusChange: (...a: unknown[]) => notify(...(a as [])) }));
vi.mock('@/lib/portal/own-units', () => ({ loadOwnPortalUnitIds: vi.fn(), ownerRecordForUnit: vi.fn() }));

import { decideArchitecturalRequest, postArchitecturalMessage } from '@/lib/rpcs/architectural';
import * as arcActions from '@/lib/rpcs/architectural';
import { decisionInputError, decisionNotice, isCurrentOwnerOccupancy } from '@/lib/architectural/rules';
import { MAX_SIGNATURE_PDF_BYTES, canReadSignedDocument, signingClosedReason } from '@/lib/signatures/crypto';

const REQ = '11111111-1111-4111-8111-111111111111';
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261015090000_arc_documents_fixes.sql'), 'utf8');

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  redirects.length = 0;
  updates.length = 0;
  inserts.length = 0;
  updateResult = { data: [{ id: REQ }], error: null };
  notify.mockReset();
  notify.mockResolvedValue(true);
});

describe('architectural decisions', () => {
  it('refuses a denial without a reason before writing', async () => {
    await expect(decideArchitecturalRequest(REQ, '/architectural-reviews', form({ decision: 'deny', decision_notes: ' ' }))).rejects.toThrow(/REDIRECT/);
    expect(updates).toHaveLength(0);
    expect(redirects.at(-1)).toContain('error=');
  });

  it('records a denial with a reason and says the homeowner was emailed only when queued', async () => {
    await expect(decideArchitecturalRequest(REQ, '/architectural-reviews', form({ decision: 'deny', decision_notes: 'Too tall' }))).rejects.toThrow(/REDIRECT/);
    expect(updates[0]).toMatchObject({ status: 'denied', decision_notes: 'Too tall' });
    expect(redirects.at(-1)).toBe(`/architectural-reviews/${REQ}?decided=denied&emailed=1`);

    notify.mockResolvedValue(false);
    await expect(decideArchitecturalRequest(REQ, '/architectural-reviews', form({ decision: 'approve' }))).rejects.toThrow(/REDIRECT/);
    expect(redirects.at(-1)).toBe(`/architectural-reviews/${REQ}?decided=approved`);
  });

  it('has no board path (the board portal is read-only)', async () => {
    await expect(decideArchitecturalRequest(REQ, '/board/architectural-reviews', form({ decision: 'approve' }))).rejects.toThrow(/REDIRECT/);
    expect(updates).toHaveLength(0);
    await expect(postArchitecturalMessage(REQ, 'staff', '/board/architectural-reviews', form({ body: 'hi' }))).rejects.toThrow(/REDIRECT/);
    expect(inserts).toHaveLength(0);
  });

  it('no longer exports the unused upload and submit actions', () => {
    expect((arcActions as any).addArchitecturalAttachment).toBeUndefined();
    expect((arcActions as any).submitArchitecturalRequest).toBeUndefined();
  });
});

describe('architectural rules', () => {
  it('requires a current owner occupancy', () => {
    expect(isCurrentOwnerOccupancy({ status: 'current', occupancy_type: 'owner', move_out_date: null }, '2026-10-14')).toBe(true);
    expect(isCurrentOwnerOccupancy({ status: 'current', occupancy_type: 'owner', move_out_date: '2026-10-14' }, '2026-10-14')).toBe(false);
    expect(isCurrentOwnerOccupancy({ status: 'past', occupancy_type: 'owner' }, '2026-10-14')).toBe(false);
    expect(isCurrentOwnerOccupancy({ status: 'current', occupancy_type: 'tenant' }, '2026-10-14')).toBe(false);
  });

  it('asks for a reason only when denying', () => {
    expect(decisionInputError('deny', null)).toMatch(/reason/);
    expect(decisionInputError('deny', 'No')).toBeNull();
    expect(decisionInputError('approve', null)).toBeNull();
  });

  it('never claims an email that was not sent', () => {
    expect(decisionNotice('approved', true)).toContain('has been emailed');
    expect(decisionNotice('approved', false)).not.toContain('has been emailed');
    expect(decisionNotice('under_review', false)).toBe('Decision recorded: Under Review.');
  });
});

describe('e-signature document access and upload size', () => {
  it('shows the document only while open and not blocked, or completed to a signer who signed', () => {
    expect(canReadSignedDocument('sent', null, 'viewed')).toBe(true);
    expect(canReadSignedDocument('sent', 'expired', 'viewed')).toBe(false);
    expect(canReadSignedDocument('sent', 'waiting', 'pending')).toBe(false);
    expect(canReadSignedDocument('voided', null, 'viewed')).toBe(false);
    expect(canReadSignedDocument('declined', null, 'signed')).toBe(false);
    expect(canReadSignedDocument('completed', null, 'signed')).toBe(true);
    expect(canReadSignedDocument('completed', null, 'pending')).toBe(false);
  });

  it('names the real reason a signer cannot sign before checking the document', () => {
    expect(signingClosedReason('sent', null)).toBeNull();
    expect(signingClosedReason('sent', 'waiting')).toMatch(/your turn/);
    expect(signingClosedReason('sent', 'expired')).toMatch(/expired/);
    expect(signingClosedReason('voided', null)).toMatch(/cancelled/);
    expect(signingClosedReason('completed', null)).toMatch(/already signed/);
    const actions = readFileSync(resolve(process.cwd(), 'app/(public)/sign/[token]/actions.ts'), 'utf8');
    expect(actions.indexOf('signingClosedReason(')).toBeLessThan(actions.indexOf('currentDocumentHash(service, session.request)'));
  });

  it('keeps uploads through server actions under the request body limit', () => {
    expect(MAX_SIGNATURE_PDF_BYTES).toBe(4 * 1024 * 1024);
    const docs = readFileSync(resolve(process.cwd(), 'lib/rpcs/association-documents.ts'), 'utf8');
    expect(docs).toContain('const MAX_BYTES = 4 * 1024 * 1024;');
    expect(docs).toContain('4 MB or smaller');
  });
});

describe('migration 20261015090000', () => {
  it('makes discussion messages insert + read only and stamps the author', () => {
    expect(migration).toContain('revoke update, delete on public.architectural_request_messages from authenticated, anon;');
    expect(migration).toMatch(/new\.author_role := 'staff';/);
    expect(migration).toMatch(/new\.author_id := auth\.uid\(\);/);
  });

  it('runs the final guard as definer, stamps decisions, and blocks API deletes', () => {
    const guard = migration.slice(migration.indexOf('create or replace function public.architectural_requests_final_guard()'));
    expect(guard.slice(0, 200)).toContain('security definer');
    expect(guard).toContain('new.decided_by := auth.uid();');
    expect(guard).toContain('Only the homeowner can withdraw a request');
    expect(guard).toContain("array['owner_id', 'unit_id', 'committee_id', 'updated_at']");
    expect(migration).toContain('revoke delete on public.architectural_requests from authenticated, anon;');
    expect(migration).toContain('new.created_at := now();');
  });

  it('treats a caller as staff only for their own associations, and scopes owner document requests', () => {
    expect(migration).toContain('can_access_association(old.association_id)');
    expect(migration).toContain('can_access_association(new.association_id)');
    expect(migration).toContain('owner_id in (select rls_private.my_managed_owner_ids())');
    expect(migration).toMatch(/create or replace trigger operator_write_guard\s+before insert or delete or update on public\.owner_form_submission_private/);
    expect(migration).toContain("replace(pg_get_functiondef(p_sig::regprocedure), chr(13), '')");
    expect(migration).toContain('after insert or update on public.owner_form_submissions');
  });

  it('guards decided requests and requires a denial reason in the database', () => {
    expect(migration).toContain("old.status in ('approved', 'denied', 'withdrawn')");
    expect(migration).toContain('public.app_is_repair_session()');
    expect(migration).toContain('Give the homeowner a reason when denying a request');
    expect(migration).toContain('trg_architectural_requests_001_final_guard');
  });

  it('rewrites the documents staff policy with once-per-query id sets', () => {
    const policy = migration.slice(migration.indexOf('alter policy documents_staff_tenant_all'));
    expect(policy).not.toMatch(/can_access_portfolio|document_portfolio_id\(/);
    expect(policy).toContain('in (select rls_private.my_document_entity_ids(');
  });

  it('checks owner/company, committee/association and e-sign rules', () => {
    expect(migration).toContain('document_requests_owner_company_check');
    expect(migration).toContain('architectural_review_settings_committee_check');
    expect(migration).toContain("using (owner_id in (select public.current_owner_ids()))");
    expect(migration).toContain('owner_form_submission_private');
    expect(migration).toContain("turn has not come yet");
    expect(migration).toContain('This request has expired');
    expect(migration).toContain('Linked record is outside the associations you manage');
    expect(migration).toContain('v_show_document');
  });

  it('is additive, re-runnable and never grants the attachment functions to signed-in users', () => {
    expect(migration).not.toMatch(/drop (table|column|policy|function|trigger)/i);
    expect(migration).not.toMatch(/delete from/i);
    expect(migration).toMatch(/revoke all on function public\.arc_append_attachment[^;]+from public, anon, authenticated;/);
    for (const m of migration.matchAll(/create policy [^;]+?on public\.\S+\s+(as restrictive\s+)?for \w+ to (\w+)/g)) {
      expect(m[2]).toBe('authenticated');
    }
  });
});
