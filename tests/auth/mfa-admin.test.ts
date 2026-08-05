import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resetUserMfa } from '@/lib/auth/mfa-admin';

function serviceWithFactors(factors: Array<{ id: string }> = [{ id: 'factor-1' }]) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  const from = vi.fn((table: string) => {
    if (table === 'audit_logs') return { insert };
    return { update };
  });
  const listFactors = vi.fn().mockResolvedValue({ data: { factors }, error: null });
  const deleteFactor = vi.fn().mockResolvedValue({ data: {}, error: null });

  return {
    service: { from, auth: { admin: { mfa: { listFactors, deleteFactor } } } },
    insert,
    listFactors,
    deleteFactor,
  };
}

describe('administrator MFA recovery', () => {
  it('writes authorization before deleting factors and records completion', async () => {
    const { service, insert, deleteFactor } = serviceWithFactors();

    const result = await resetUserMfa({
      service,
      userId: '00000000-0000-0000-0000-000000000001',
      targetEmail: 'manager@example.com',
      actorId: '00000000-0000-0000-0000-000000000002',
      actorEmail: 'admin@example.com',
      portfolioId: '00000000-0000-0000-0000-000000000003',
    });

    expect(result).toEqual({ factorCount: 1, error: null });
    expect(insert.mock.invocationCallOrder[0]).toBeLessThan(deleteFactor.mock.invocationCallOrder[0]);
    expect(insert).toHaveBeenNthCalledWith(1, expect.objectContaining({ action: 'mfa_reset_authorized' }));
    expect(insert).toHaveBeenNthCalledWith(2, expect.objectContaining({ action: 'mfa_reset_completed' }));
  });

  it('does not delete any factor when the authorization audit fails', async () => {
    const { service, insert, deleteFactor } = serviceWithFactors();
    insert.mockResolvedValueOnce({ error: { message: 'audit unavailable' } });

    const result = await resetUserMfa({
      service,
      userId: '00000000-0000-0000-0000-000000000001',
      targetEmail: 'manager@example.com',
      actorId: '00000000-0000-0000-0000-000000000002',
      actorEmail: 'admin@example.com',
    });

    expect(result.error).toContain('audit record could not be created');
    expect(deleteFactor).not.toHaveBeenCalled();
  });
});
