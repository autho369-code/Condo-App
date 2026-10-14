import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rpc = vi.fn();
const redirects: string[] = [];
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { redirects.push(url); throw new Error(`REDIRECT ${url}`); },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
const requireFinanceStaff = vi.fn(async () => ({ auth_user_id: 'u1' }));
vi.mock('@/lib/auth/me', () => ({ requireFinanceStaff: () => requireFinanceStaff() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }));
vi.mock('@/lib/forms/submission', () => ({ claimSubmission: vi.fn(), completeSubmission: vi.fn(), releaseSubmission: vi.fn() }));

import { removeLateFee } from '@/lib/rpcs/credits';

const UNIT = '11111111-1111-4111-8111-111111111111';
const FEE = '22222222-2222-4222-8222-222222222222';

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

async function run(fields: Record<string, string>) {
  await expect(removeLateFee(form(fields))).rejects.toThrow(/REDIRECT/);
  return redirects.at(-1)!;
}

beforeEach(() => {
  rpc.mockReset();
  requireFinanceStaff.mockClear();
  redirects.length = 0;
});

describe('remove a late fee', () => {
  it('asks the database to remove it, with the reason', async () => {
    rpc.mockResolvedValue({ data: 'credit-id', error: null });
    const to = await run({ unit_id: UNIT, charge_id: FEE, reason: 'Board approved waiver' });
    expect(requireFinanceStaff).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('remove_late_fee', { p_charge_id: FEE, p_reason: 'Board approved waiver' });
    expect(to).toBe(`/units/${UNIT}?saved=late_fee_removed#late-fees`);
  });

  it('needs a reason', async () => {
    const to = await run({ unit_id: UNIT, charge_id: FEE, reason: ' ' });
    expect(rpc).not.toHaveBeenCalled();
    expect(to).toContain('error=');
  });

  it('shows the database refusal (e.g. already paid) on the unit page', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'This late fee is already paid or removed.' } });
    const to = await run({ unit_id: UNIT, charge_id: FEE, reason: 'Board approved waiver' });
    expect(decodeURIComponent(to)).toContain('already paid or removed');
    expect(to.startsWith(`/units/${UNIT}?error=`)).toBe(true);
  });

  it('refuses malformed ids without calling the database', async () => {
    const to = await run({ unit_id: UNIT, charge_id: 'nope', reason: 'Board approved waiver' });
    expect(rpc).not.toHaveBeenCalled();
    expect(to).toContain('error=');
  });
});
