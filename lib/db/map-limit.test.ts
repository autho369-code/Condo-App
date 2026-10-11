import { describe, expect, it } from 'vitest';
import { mapLimit } from './map-limit';

describe('mapLimit', () => {
  it('keeps the items order and never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    const result = await mapLimit([30, 5, 20, 1, 10], 2, async (ms, i) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running -= 1;
      return i * 10;
    });
    expect(result).toEqual([0, 10, 20, 30, 40]);
    expect(peak).toBe(2);
  });

  it('handles an empty list and a limit above the item count', async () => {
    expect(await mapLimit([], 3, async () => 1)).toEqual([]);
    expect(await mapLimit([1, 2], 10, async (n) => n * 2)).toEqual([2, 4]);
  });

  it('passes a rejection through', async () => {
    await expect(mapLimit([1, 2], 1, async (n) => { if (n === 2) throw new Error('boom'); return n; })).rejects.toThrow('boom');
  });
});
