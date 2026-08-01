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

describe('owner insurance policy filing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwner.mockResolvedValue({ auth_user_id: 'auth-a', owner_id: 'owner-a' });
  });

  it('files an uploaded certificate with the supported HO6 document type', async () => {
    const { db, policyInsert } = sessionDb();
    const documentInsert = vi.fn().mockResolvedValue({ error: null });
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(db);
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({ insert: documentInsert })),
      storage: { from: vi.fn(() => ({ remove: storageRemove })) },
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
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it('removes the policy row and uploaded object when document filing fails', async () => {
    const { db } = sessionDb();
    const policyDeleteEq = vi.fn().mockReturnThis();
    const documentInsert = vi.fn().mockResolvedValue({ error: { message: 'constraint failed' } });
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(db);
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => table === 'documents'
        ? { insert: documentInsert }
        : { delete: vi.fn(() => ({ eq: policyDeleteEq })) }),
      storage: { from: vi.fn(() => ({ remove: storageRemove })) },
    });

    await expect(saveInsurancePolicy(input)).resolves.toEqual({
      error: 'Could not file the policy document: constraint failed',
    });

    expect(policyDeleteEq).toHaveBeenCalledWith('id', 'policy-a');
    expect(policyDeleteEq).toHaveBeenCalledWith('owner_id', 'owner-a');
    expect(storageRemove).toHaveBeenCalledWith([input.cert.path]);
  });
});
