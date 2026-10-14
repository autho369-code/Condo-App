import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({ rpc }) }));
vi.mock('@/lib/server/rate-limit', () => ({
  consumePublicRateLimit: async () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0 }),
  consumeScopedRateLimit: async () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0 }),
}));
vi.mock('@/lib/email/webhook-signature', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/webhook-signature')>()),
  verifySvixSignature: () => true,
}));

import { isUnsubscribeToken, oneClickUrl, unsubscribeFooter, unsubscribeHeaders } from '@/lib/email/unsubscribe';
import { GET as openLink, POST as oneClick } from '@/app/api/unsubscribe/[token]/route';
import { POST as resendWebhook } from '@/app/api/webhooks/resend/route';

const TOKEN = 'a'.repeat(64);
const PAGE = `https://stellar.portier369.com/unsubscribe/${TOKEN}`;

beforeEach(() => {
  rpc.mockReset();
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_dGVzdA==';
});

describe('unsubscribe links', () => {
  it('accepts only server-made tokens', () => {
    expect(isUnsubscribeToken(TOKEN)).toBe(true);
    expect(isUnsubscribeToken('A'.repeat(64))).toBe(false);
    expect(isUnsubscribeToken('a'.repeat(63))).toBe(false);
  });

  it('puts the one-click address in the headers mail providers read (RFC 8058)', () => {
    expect(oneClickUrl(PAGE)).toBe(`https://stellar.portier369.com/api/unsubscribe/${TOKEN}`);
    expect(unsubscribeHeaders(PAGE)).toEqual({
      'List-Unsubscribe': `<https://stellar.portier369.com/api/unsubscribe/${TOKEN}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('names the company in the footer, escaped', () => {
    const footer = unsubscribeFooter(PAGE, 'Smith & <Co>');
    expect(footer).toContain('Smith &amp; &lt;Co&gt;');
    expect(footer).toContain(`href="${PAGE}"`);
    expect(footer).not.toMatch(/portier369 (team|platform)/i);
  });
});

function post(url: string) {
  return new Request(url, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } }) as any;
}

describe('one-click unsubscribe', () => {
  it('unsubscribes the link\'s recipient', async () => {
    rpc.mockImplementation(async (fn: string) => fn === 'email_unsubscribe_session'
      ? { data: { portfolio_id: 'p1', company_name: 'Stellar' }, error: null }
      : { data: true, error: null });
    const res = await oneClick(post(`https://example.test/api/unsubscribe/${TOKEN}`), { params: Promise.resolve({ token: TOKEN }) });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('email_set_unsubscribed', { p_token: TOKEN, p_unsubscribed: true, p_source: 'one_click' });
  });

  it('refuses an unknown or malformed token without changing anything', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const unknown = await oneClick(post(`https://example.test/api/unsubscribe/${TOKEN}`), { params: Promise.resolve({ token: TOKEN }) });
    expect(unknown.status).toBe(404);
    const bad = await oneClick(post('https://example.test/api/unsubscribe/x'), { params: Promise.resolve({ token: 'x' }) });
    expect(bad.status).toBe(404);
    expect(rpc).not.toHaveBeenCalledWith('email_set_unsubscribed', expect.anything());
  });

  it('opening the link in a browser shows the page and changes nothing', async () => {
    const req = { nextUrl: new URL(`https://example.test/api/unsubscribe/${TOKEN}`) } as any;
    const res = await openLink(req, { params: Promise.resolve({ token: TOKEN }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`https://example.test/unsubscribe/${TOKEN}`);
    expect(rpc).not.toHaveBeenCalled();
  });
});

function resendEvent(type: string, data: Record<string, unknown>) {
  return new Request('https://example.test/api/webhooks/resend', {
    method: 'POST',
    headers: { 'svix-id': 'msg_1', 'svix-timestamp': '1', 'svix-signature': 'v1,x' },
    body: JSON.stringify({ type, created_at: new Date().toISOString(), data: { email_id: 'em_1', ...data } }),
  }) as any;
}

describe('bounces and complaints from Resend', () => {
  beforeEach(() => rpc.mockResolvedValue({ data: true, error: null }));

  it('suppresses the address after a permanent bounce', async () => {
    const res = await resendWebhook(resendEvent('email.bounced', { bounce: { type: 'Permanent', message: 'No such user' } }));
    expect(res.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith('email_suppress_from_event', { p_provider_message_id: 'em_1', p_reason: 'bounced', p_detail: 'No such user' });
  });

  it('keeps sending after a temporary bounce', async () => {
    await resendWebhook(resendEvent('email.bounced', { bounce: { type: 'Transient', message: 'Mailbox full' } }));
    expect(rpc).not.toHaveBeenCalledWith('email_suppress_from_event', expect.anything());
  });

  it('suppresses the address after a spam complaint', async () => {
    await resendWebhook(resendEvent('email.complained', {}));
    expect(rpc).toHaveBeenCalledWith('email_suppress_from_event', { p_provider_message_id: 'em_1', p_reason: 'complained', p_detail: null });
  });
});
