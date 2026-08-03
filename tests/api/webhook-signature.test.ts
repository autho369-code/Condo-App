import { describe, expect, it } from 'vitest';
import { webhookSignature } from '@/lib/webhooks/deliver';

describe('Portier webhook signing', () => {
  it('signs the exact timestamp and body deterministically', () => {
    expect(webhookSignature('secret', '1700000000', '{"id":"evt_1"}')).toBe('af784f27423c462e20039559cd4264140f7b7ed4c9090e26fd663faa5eeb8dda');
  });
});
