import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSignedUrls = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ storage: { from: () => ({ createSignedUrls }) } }),
}));

import { audienceLabel, signFormFiles } from '@/lib/forms/files';

const P = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('signFormFiles', () => {
  beforeEach(() => {
    createSignedUrls.mockReset();
    createSignedUrls.mockImplementation(async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `signed:${p}` })) }));
  });

  it('signs only files inside their own portfolio folder', async () => {
    const links = await signFormFiles([
      { id: 'a', portfolio_id: P, file_path: `forms/${P}/x.pdf` },
      { id: 'b', portfolio_id: P, file_path: `forms/${OTHER}/y.pdf` },
      { id: 'c', portfolio_id: P, file_path: `forms/${P}/../${OTHER}/z.pdf` },
      { id: 'd', portfolio_id: P, file_path: null },
    ]);
    expect(createSignedUrls).toHaveBeenCalledWith([`forms/${P}/x.pdf`], 600);
    expect([...links.entries()]).toEqual([['a', `signed:forms/${P}/x.pdf`]]);
  });

  it('makes no storage call when nothing needs signing', async () => {
    expect((await signFormFiles([{ id: 'd', portfolio_id: P, file_path: null }])).size).toBe(0);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});

describe('audienceLabel', () => {
  it('names each audience', () => {
    expect(audienceLabel('homeowner')).toBe('Homeowners');
    expect(audienceLabel('vendor')).toBe('Vendors');
    expect(audienceLabel('internal')).toBe('Internal');
    expect(audienceLabel(null)).toBe('Homeowners');
  });
});
