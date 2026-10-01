import { describe, expect, it } from 'vitest';


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('form submission tokens', () => {
  it('derives the same valid token for the same content', async () => {
    const { contentSubmissionToken } = await import('@/lib/forms/submission');
    const a = await contentSubmissionToken('lockbox', 'bank', '2026-10-01', 'check,1\n');
    const b = await contentSubmissionToken('lockbox', 'bank', '2026-10-01', 'check,1\n');
    const c = await contentSubmissionToken('lockbox', 'bank', '2026-10-02', 'check,1\n');
    expect(a).toMatch(UUID);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it('reports a repeat submission as a duplicate with the first result', async () => {
    const { claimSubmission, SUBMISSION_FIELD } = await import('@/lib/forms/submission');
    const fd = new FormData();
    fd.set(SUBMISSION_FIELD, '11111111-1111-4111-8111-111111111111');
    const db = {
      from: () => ({
        insert: async () => ({ error: { code: '23505', message: 'duplicate key' } }),
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { result_id: 'pay-1' } }) }) }),
      }),
    };
    expect(await claimSubmission(db, fd, 'homeowner_receipt')).toEqual({ status: 'duplicate', resultId: 'pay-1' });
  });

  it('rejects a missing token', async () => {
    const { claimSubmission } = await import('@/lib/forms/submission');
    const res = await claimSubmission({}, new FormData(), 'homeowner_receipt');
    expect(res.status).toBe('error');
  });
});
