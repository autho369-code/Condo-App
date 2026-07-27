import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  consumePublic: vi.fn(),
  consumeScoped: vi.fn(),
  resendSend: vi.fn(),
  queueEmails: vi.fn(),
  getAIConfig: vi.fn(),
  visionCompletion: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('@/lib/server/rate-limit', () => ({
  consumePublicRateLimit: mocks.consumePublic,
  consumeScopedRateLimit: mocks.consumeScoped,
  rateLimitHeaders: (result: any) => ({
    'Cache-Control': 'no-store',
    'Retry-After': String(result.retryAfterSeconds),
    'X-RateLimit-Remaining': String(result.remaining),
  }),
}));
vi.mock('@/lib/email/queue', () => ({ queueEmails: mocks.queueEmails }));
vi.mock('@/lib/ai/service', () => ({
  getAIConfig: mocks.getAIConfig,
  visionCompletion: mocks.visionCompletion,
}));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.resendSend };
  },
}));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import { POST as piperPost } from '@/app/api/piper/route';
import { POST as demoPost } from '@/app/api/demo-request/route';
import { POST as photoPost } from '@/app/api/ai/analyze-violation-photo/route';
import { submitReport } from '@/app/(public)/report-violation/actions';

const allowed = { allowed: true, remaining: 4, retryAfterSeconds: 3600 };
const denied = { allowed: false, remaining: 0, retryAfterSeconds: 900 };

describe('public endpoint abuse guards', () => {
  beforeEach(() => {
    const service = { from: vi.fn(), rpc: vi.fn() };
    mocks.createServiceClient.mockReturnValue(service);
    mocks.consumePublic.mockResolvedValue(allowed);
    mocks.consumeScoped.mockResolvedValue(allowed);
    mocks.headers.mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.4' }));
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-deepseek-key');
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('stops Piper before parsing history, loading knowledge, or calling the provider', async () => {
    mocks.consumePublic.mockResolvedValueOnce(denied);
    const providerFetch = vi.spyOn(globalThis, 'fetch');
    const request = new Request('http://localhost/api/piper', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.4' },
      body: JSON.stringify({ sessionId: 'web-session123', messages: [{ role: 'user', content: 'Hello' }] }),
    });

    const response = await piperPost(request as any);

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('900');
    expect(mocks.createServiceClient.mock.results[0].value.from).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('rejects oversized Piper payloads before opening a service client', async () => {
    const request = new Request('http://localhost/api/piper', {
      method: 'POST',
      headers: { 'content-length': String(40 * 1024) },
    });

    const response = await piperPost(request as any);

    expect(response.status).toBe(413);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('rate-limits demo submissions before parsing or sending email', async () => {
    mocks.consumePublic.mockResolvedValueOnce(denied);
    const request = new Request('http://localhost/api/demo-request', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'company_name=Example',
    });

    const response = await demoPost(request);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/demo?error=rate-limit');
    expect(response.headers.get('retry-after')).toBe('900');
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it('rejects oversized demo forms before opening a service client', async () => {
    const request = new Request('http://localhost/api/demo-request', {
      method: 'POST',
      headers: { 'content-length': String(65 * 1024) },
    });

    const response = await demoPost(request);

    expect(response.status).toBe(413);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('silently discards demo-form honeypot submissions', async () => {
    const form = new URLSearchParams({
      office_fax: '555-0100',
      company_name: 'Bot Company',
    });
    const request = new Request('http://localhost/api/demo-request', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const response = await demoPost(request);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/demo?submitted=1');
    expect(mocks.consumeScoped).not.toHaveBeenCalled();
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it('rejects oversized photo requests before rate-limit or AI work', async () => {
    const request = new Request('http://localhost/api/ai/analyze-violation-photo', {
      method: 'POST',
      headers: { 'content-length': String(10 * 1024 * 1024) },
    });

    const response = await photoPost(request as any);

    expect(response.status).toBe(413);
    expect(mocks.consumePublic).not.toHaveBeenCalled();
    expect(mocks.visionCompletion).not.toHaveBeenCalled();
  });

  it('stops photo analysis before association or provider reads when denied', async () => {
    mocks.consumePublic.mockResolvedValueOnce(denied);
    const request = new Request('http://localhost/api/ai/analyze-violation-photo', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.4' },
    });

    const response = await photoPost(request as any);

    expect(response.status).toBe(429);
    expect(mocks.createServiceClient.mock.results[0].value.from).not.toHaveBeenCalled();
    expect(mocks.getAIConfig).not.toHaveBeenCalled();
    expect(mocks.visionCompletion).not.toHaveBeenCalled();
  });

  it('uses the server-only service client for anonymous photo configuration and rule reads', async () => {
    const associationId = '11111111-1111-4111-8111-111111111111';
    const portfolioId = '22222222-2222-4222-8222-222222222222';
    const associationQuery: any = {};
    associationQuery.select = vi.fn(() => associationQuery);
    associationQuery.eq = vi.fn(() => associationQuery);
    associationQuery.is = vi.fn(() => associationQuery);
    associationQuery.maybeSingle = vi.fn().mockResolvedValue({ data: { portfolio_id: portfolioId } });
    const rulesQuery: any = {};
    rulesQuery.select = vi.fn(() => rulesQuery);
    rulesQuery.eq = vi.fn(() => rulesQuery);
    rulesQuery.order = vi.fn().mockResolvedValue({ data: [] });
    const service = {
      rpc: vi.fn(),
      from: vi.fn((table: string) => table === 'associations' ? associationQuery : rulesQuery),
    };
    mocks.createServiceClient.mockReturnValue(service);
    mocks.getAIConfig.mockResolvedValue({ provider: 'openai', model: 'test', apiKey: 'secret' });
    mocks.visionCompletion.mockResolvedValue(JSON.stringify({
      violation_type: 'other',
      severity: 'low',
      confidence: 90,
    }));

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer),
    });
    const form = new FormData();
    form.append('file', file);
    form.append('association_id', associationId);
    const request = {
      headers: new Headers({ 'x-forwarded-for': '203.0.113.4' }),
      formData: vi.fn().mockResolvedValue(form),
    };

    const response = await photoPost(request as any);

    expect(response.status).toBe(200);
    expect(service.from).toHaveBeenCalledWith('associations');
    expect(service.from).toHaveBeenCalledWith('house_rules');
    expect(mocks.getAIConfig).toHaveBeenCalledWith(portfolioId, service);
    expect(mocks.visionCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test' }),
      expect.any(String),
      expect.any(String),
      'image/png',
    );
  });

  it('stops anonymous violation reports before association or case writes when denied', async () => {
    mocks.consumePublic.mockResolvedValueOnce(denied);
    const form = new FormData();

    await expect(submitReport(form)).rejects.toThrow('REDIRECT:/report-violation?error=rate-limit');

    expect(mocks.createServiceClient.mock.results[0].value.from).not.toHaveBeenCalled();
    expect(mocks.consumeScoped).not.toHaveBeenCalled();
  });
});
