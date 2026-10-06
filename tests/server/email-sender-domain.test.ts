import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  brandedFromAddress,
  dnsRecords,
  isSenderDomainError,
  parseSenderSettings,
  usesPlatformSender,
} from '../../lib/email/sender-domains';

const sent: Array<{ from: string; key: string }> = [];
let refuseBranded = false;
let queued: any[] = [];
let domains: any[] = [];

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (payload: any, options: any) => {
        sent.push({ from: payload.from, key: options.idempotencyKey });
        if (refuseBranded && payload.from.includes('stellarpropertygroup.com')) {
          return { data: null, error: { message: 'The stellarpropertygroup.com domain is not verified.' } };
        }
        return { data: { id: `msg-${sent.length}` }, error: null };
      },
    };
  },
}));

vi.mock('@/lib/server/cron-auth', () => ({ requireCronSecret: () => null }));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    rpc: async (name: string) => (name === 'claim_email_queue' ? { data: queued, error: null } : { data: true, error: null }),
    from: (table: string) => ({
      select: () => ({
        in: async () => (table === 'portfolios'
          ? { data: [{ id: 'p1', company_name: 'Stellar Property Group' }], error: null }
          : { data: domains, error: null }),
      }),
    }),
  }),
}));

const verified = { portfolio_id: 'p1', domain: 'stellarpropertygroup.com', from_local_part: 'notices', status: 'verified', enabled: true };
const email = (over: Record<string, unknown> = {}) => ({
  id: 'e1', to_email: 'owner@example.com', subject: 'Hello', body: '<p>Hi</p>',
  from_address: 'hello@portier369.com', from_name: null, portfolio_id: 'p1', ...over,
});

async function runWorker() {
  vi.stubEnv('RESEND_API_KEY', 're_test');
  const { GET } = await import('../../app/api/email/process-queue/route');
  return (await GET(new NextRequest('https://portier369.com/api/email/process-queue'))).json();
}

describe('sender domain helpers', () => {
  it('validates the domain and the part before @', () => {
    expect(parseSenderSettings('StellarPropertyGroup.com', '')).toEqual({ ok: true, domain: 'stellarpropertygroup.com', localPart: 'notices' });
    expect(parseSenderSettings('stellarpropertygroup.com', 'Billing.Team')).toMatchObject({ ok: true, localPart: 'billing.team' });
    expect(parseSenderSettings('', 'notices').ok).toBe(false);
    expect(parseSenderSettings('mail.portier369.com', 'notices').ok).toBe(false);
    for (const bad of ['a..b', '.a', 'a b', 'a@b']) expect(parseSenderSettings('acme.com', bad).ok, bad).toBe(false);
  });

  it('uses the company address only while verified and switched on', () => {
    expect(brandedFromAddress(verified)).toBe('notices@stellarpropertygroup.com');
    expect(brandedFromAddress({ ...verified, status: 'pending' })).toBeNull();
    expect(brandedFromAddress({ ...verified, enabled: false })).toBeNull();
    expect(brandedFromAddress(null)).toBeNull();
  });

  it('moves only mail queued from the platform default sender', () => {
    expect(usesPlatformSender('hello@portier369.com')).toBe(true);
    expect(usesPlatformSender('NoReply@portier369.com')).toBe(true);
    expect(usesPlatformSender(null)).toBe(true);
    expect(usesPlatformSender('billing@portier369.com')).toBe(false);
  });

  it('recognises a refused sender domain and keeps displayable DNS records', () => {
    expect(isSenderDomainError('The acme.com domain is not verified')).toBe(true);
    expect(isSenderDomainError('Rate limit exceeded')).toBe(false);
    expect(dnsRecords([{ record: 'DKIM', type: 'TXT', name: 'resend._domainkey', value: 'p=abc', status: 'pending' }, { type: 'MX' }, null]))
      .toEqual([{ record: 'DKIM', type: 'TXT', name: 'resend._domainkey', value: 'p=abc', priority: null, status: 'pending' }]);
  });
});

describe('email worker sender selection', () => {
  beforeEach(() => {
    sent.length = 0;
    refuseBranded = false;
    vi.resetModules();
  });

  it("sends company mail from the company's verified domain", async () => {
    queued = [email()];
    domains = [verified];
    expect(await runWorker()).toMatchObject({ sent: 1, failed: 0 });
    expect(sent).toEqual([{ from: 'Stellar Property Group <notices@stellarpropertygroup.com>', key: 'email-queue-e1-notices@stellarpropertygroup.com' }]);
  });

  it('keeps the platform address while the domain is unverified', async () => {
    queued = [email()];
    domains = [{ ...verified, status: 'pending' }];
    await runWorker();
    expect(sent).toEqual([{ from: 'Stellar Property Group <hello@portier369.com>', key: 'email-queue-e1' }]);
  });

  it('keeps platform mail with an explicit sender name on the platform domain', async () => {
    queued = [email({ from_name: 'Portier369' })];
    domains = [verified];
    await runWorker();
    expect(sent).toEqual([{ from: 'Portier369 <hello@portier369.com>', key: 'email-queue-e1' }]);
  });

  it('falls back to the platform address when the provider refuses the company domain', async () => {
    queued = [email()];
    domains = [verified];
    refuseBranded = true;
    expect(await runWorker()).toMatchObject({ sent: 1, failed: 0 });
    expect(sent.map((s) => s.from)).toEqual([
      'Stellar Property Group <notices@stellarpropertygroup.com>',
      'Stellar Property Group <hello@portier369.com>',
    ]);
  });
});

describe('registerSenderDomain', () => {
  it('reuses a domain already registered with the provider', async () => {
    const { registerSenderDomain } = await import('../../lib/email/sender-domains');
    const resend: any = {
      domains: {
        create: async () => ({ data: null, error: { message: 'Domain already exists' } }),
        list: async ({ after }: { after?: string }) => (after
          ? { data: { data: [{ id: 'd2', name: 'stellarpropertygroup.com' }], has_more: false }, error: null }
          : { data: { data: [{ id: 'd1', name: 'other.com' }], has_more: true }, error: null }),
        get: async (id: string) => ({ data: { id, status: 'verified', records: [] }, error: null }),
      },
    };
    expect(await registerSenderDomain(resend, 'stellarpropertygroup.com'))
      .toEqual({ ok: true, domain: { id: 'd2', status: 'verified', records: [] } });
  });

  it('reports the provider error when the domain is not in the account', async () => {
    const { registerSenderDomain } = await import('../../lib/email/sender-domains');
    const resend: any = {
      domains: {
        create: async () => ({ data: null, error: { message: 'API key is restricted to sending' } }),
        list: async () => ({ data: { data: [], has_more: false }, error: null }),
      },
    };
    expect(await registerSenderDomain(resend, 'acme.com')).toEqual({ ok: false, error: 'API key is restricted to sending' });
  });
});
