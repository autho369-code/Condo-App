import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { resendEventType, verifySvixSignature } from './webhook-signature';

const secretBytes = Buffer.from('portier369-test-secret-portier369');
const secret = `whsec_${secretBytes.toString('base64')}`;
const sign = (id: string, ts: string, body: string) =>
  `v1,${createHmac('sha256', secretBytes).update(`${id}.${ts}.${body}`).digest('base64')}`;

describe('verifySvixSignature', () => {
  const now = 1_790_000_000_000;
  const ts = String(now / 1000);
  const body = '{"type":"email.opened"}';

  it('accepts a valid signature, including alongside a rotated one', () => {
    expect(verifySvixSignature({ secret, id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body), body, now })).toBe(true);
    expect(verifySvixSignature({ secret, id: 'msg_1', timestamp: ts, signature: `v1,AAAA ${sign('msg_1', ts, body)}`, body, now })).toBe(true);
  });

  it('rejects a tampered body, wrong id, stale timestamp or missing headers', () => {
    expect(verifySvixSignature({ secret, id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body), body: body + ' ', now })).toBe(false);
    expect(verifySvixSignature({ secret, id: 'msg_2', timestamp: ts, signature: sign('msg_1', ts, body), body, now })).toBe(false);
    expect(verifySvixSignature({ secret, id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body), body, now: now + 10 * 60_000 })).toBe(false);
    expect(verifySvixSignature({ secret, id: null, timestamp: ts, signature: sign('msg_1', ts, body), body, now })).toBe(false);
  });
});

describe('resendEventType', () => {
  it('maps known events and ignores others', () => {
    expect(resendEventType('email.opened')).toBe('opened');
    expect(resendEventType('email.bounced')).toBe('bounced');
    expect(resendEventType('contact.created')).toBeNull();
  });
});
