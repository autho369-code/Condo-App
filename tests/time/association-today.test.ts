import { describe, expect, it } from 'vitest';
import { associationToday } from '@/lib/time/association-today';

function db(result: { data: any; error: any }) {
  const b: any = { select: () => b, eq: () => b, maybeSingle: async () => result };
  return { from: () => b };
}

describe('associationToday', () => {
  it('stops the send when the association lookup fails', async () => {
    await expect(associationToday(db({ data: null, error: { message: 'timeout' } }), 'a1'))
      .resolves.toEqual({ today: null, error: 'timeout' });
    await expect(associationToday(db({ data: null, error: null }), 'a1'))
      .resolves.toEqual({ today: null, error: 'association not found' });
  });

  it('uses the association zone, or the default zone when it has none', async () => {
    const zoned = await associationToday(db({ data: { timezone: 'Pacific/Kiritimati' }, error: null }), 'a1');
    expect(zoned.error).toBeNull();
    expect(zoned.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const fallback = await associationToday(db({ data: { timezone: 'Not/AZone' }, error: null }), 'a1');
    expect(fallback.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
