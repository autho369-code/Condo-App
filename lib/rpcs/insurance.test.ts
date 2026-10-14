import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  requireOwner: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('@/lib/auth/me', () => ({ requireOwner: mocks.requireOwner }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { saveInsurancePolicy } from '@/lib/rpcs/insurance';

const input = {
  carrier: 'Test Mutual',
  policyNumber: 'HO6-100',
  coverageAmount: '325,000',
  effectiveDate: '2026-08-01',
  expirationDate: '2027-07-31',
  remindOwner: true,
  remindManager: true,
  cert: { path: 'insurance/owner-a/policy.pdf', name: 'policy.pdf' },
};

function sessionDb() {
  const policyInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'policy-a' }, error: null }),
    }),
  });
  const occupancy = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { association_id: 'association-a' }, error: null }),
  };
  return {
    policyInsert,
    db: {
      from: vi.fn((table: string) => table === 'occupancies' ? occupancy : { insert: policyInsert }),
    },
  };
}

// The certificate check: the uploaded object exists, and no policy or
// document already names that file.
function certificateReads(refCount = 0) {
  return {
    select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ count: refCount, error: null }) })),
  };
}
function storage(remove: ReturnType<typeof vi.fn>) {
  return {
    from: vi.fn(() => ({
      remove,
      info: vi.fn().mockResolvedValue({ data: { size: 2048 }, error: null }),
    })),
  };
}

describe('owner insurance policy filing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwner.mockResolvedValue({ auth_user_id: 'auth-a', owner_id: 'owner-a', owner_ids: ['owner-a'] });
  });

  it('files an uploaded certificate with the supported HO6 document type, before saving the policy', async () => {
    const { db, policyInsert } = sessionDb();
    const documentInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'document-a' }, error: null }) }),
    });
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(db);
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({ insert: documentInsert, ...certificateReads() })),
      storage: storage(storageRemove),
    });

    await expect(saveInsurancePolicy(input)).resolves.toEqual({ ok: true });

    expect(policyInsert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'owner-a',
      association_id: 'association-a',
      coverage_amount: 325000,
      certificate_file_url: input.cert.path,
    }));
    expect(documentInsert).toHaveBeenCalledWith(expect.objectContaining({
      entity_type: 'owner',
      entity_id: 'owner-a',
      doc_type: 'ho6',
      file_url: input.cert.path,
    }));
    // A saved policy archives the earlier one, so the document goes first.
    expect(documentInsert.mock.invocationCallOrder[0]).toBeLessThan(policyInsert.mock.invocationCallOrder[0]);
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it('saves no policy and removes the upload when document filing fails', async () => {
    const { db, policyInsert } = sessionDb();
    const documentInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { message: 'constraint failed' } }) }),
    });
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(db);
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({ insert: documentInsert, ...certificateReads() })),
      storage: storage(storageRemove),
    });

    await expect(saveInsurancePolicy(input)).resolves.toEqual({
      error: 'Could not file the policy document: constraint failed',
    });

    expect(policyInsert).not.toHaveBeenCalled();
    expect(storageRemove).toHaveBeenCalledWith([input.cert.path]);
  });

  it('removes the filed document and upload when the policy is refused', async () => {
    const { db, policyInsert } = sessionDb();
    policyInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { message: 'row-level security' } }) }),
    });
    const documentInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'document-a' }, error: null }) }),
    });
    const documentDeleteEq = vi.fn().mockReturnThis();
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(db);
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({ insert: documentInsert, delete: vi.fn(() => ({ eq: documentDeleteEq })), ...certificateReads() })),
      storage: storage(storageRemove),
    });

    await expect(saveInsurancePolicy(input)).resolves.toEqual({ error: 'row-level security' });
    expect(documentDeleteEq).toHaveBeenCalledWith('id', 'document-a');
    expect(documentDeleteEq).toHaveBeenCalledWith('entity_id', 'owner-a');
    expect(storageRemove).toHaveBeenCalledWith([input.cert.path]);
  });

  it('refuses a certificate already on file and never removes it', async () => {
    const { db, policyInsert } = sessionDb();
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(db);
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => certificateReads(1)),
      storage: storage(storageRemove),
    });

    await expect(saveInsurancePolicy(input)).resolves.toEqual({
      error: "That certificate is already on file. Upload the new policy's certificate.",
    });
    expect(policyInsert).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });
});
