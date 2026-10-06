import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  brandedFromAddress,
  isPlatformSenderName,
  platformSenderAddress,
  dnsRecords,
  isSenderDomainError,
  parseSenderSettings,
  usesPlatformSender,
} from '../../lib/email/sender-domains';

const sent: Array<{ from: string; key: string }> = [];
let refuseBranded = false;
let queued: any[] = [];
let domains: any[] = [];
let owners: any[] = [];
const snapshots: Array<{ id: string; sender_address: string }> = [];

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
    rpc: async (name: string) => (name === 'claim_email_queue_snapshot' ? { data: queued, error: null } : { data: true, error: null }),
    from: (table: string) => ({
      update: (values: any) => ({
        eq: async (_col: string, id: string) => {
          snapshots.push({ id, sender_address: values.sender_address });
          return { error: null };
        },
      }),
      select: () => ({
        in: async () => (table === 'portfolios'
          ? { data: [{ id: 'p1', company_name: 'Stellar Property Group' }], error: null }
          : table === 'email_sender_domain_owners'
            ? { data: owners, error: null }
            : { data: domains, error: null }),
      }),
    }),
  }),
}));

const brandedKey = `email-queue-e1-${createHash('sha256').update('notices@stellarpropertygroup.com').digest('hex').slice(0, 16)}`;
const verified = { portfolio_id: 'p1', domain: 'stellarpropertygroup.com', from_local_part: 'notices', status: 'verified', enabled: true };
const email = (over: Record<string, unknown> = {}) => ({
  id: 'e1', attempt_count: 1, snapshot_claims: 1, to_email: 'owner@example.com', subject: 'Hello', body: '<p>Hi</p>',
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

  it('recognises platform-originated sender names', () => {
    expect(isPlatformSenderName('Portier369')).toBe(true);
    expect(isPlatformSenderName('Portier369 Platform')).toBe(true);
    expect(isPlatformSenderName('Stellar Property Group')).toBe(false);
    expect(isPlatformSenderName(null)).toBe(false);
  });

  it('honours only platform-domain queued senders', () => {
    expect(platformSenderAddress('noreply@portier369.com')).toBe('noreply@portier369.com');
    expect(platformSenderAddress('notices@othercompany.com')).toBe('hello@portier369.com');
    expect(platformSenderAddress('x@evilportier369.com')).toBe('hello@portier369.com');
    expect(platformSenderAddress(null)).toBe('hello@portier369.com');
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
    snapshots.length = 0;
    refuseBranded = false;
    owners = [{ portfolio_id: 'p1', domain: 'stellarpropertygroup.com' }];
    vi.resetModules();
  });

  it("sends company mail from the company's verified domain", async () => {
    queued = [email()];
    domains = [verified];
    expect(await runWorker()).toMatchObject({ sent: 1, failed: 0 });
    expect(sent).toEqual([{ from: 'Stellar Property Group <notices@stellarpropertygroup.com>', key: brandedKey }]);
    expect(snapshots).toEqual([{ id: 'e1', sender_address: 'notices@stellarpropertygroup.com' }]);
  });

  it('uses the company domain for mail that names the company', async () => {
    queued = [email({ from_name: 'Stellar Property Group' })];
    domains = [verified];
    await runWorker();
    expect(sent).toEqual([{ from: 'Stellar Property Group <notices@stellarpropertygroup.com>', key: brandedKey }]);
  });

  it('replays a retry with the sender chosen on the first attempt', async () => {
    queued = [email({ sender_address: 'notices@stellarpropertygroup.com' })];
    domains = [{ ...verified, enabled: false }];
    await runWorker();
    expect(sent).toEqual([{ from: 'Stellar Property Group <notices@stellarpropertygroup.com>', key: brandedKey }]);
    expect(snapshots).toEqual([]);
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
    expect(snapshots).toEqual([{ id: 'e1', sender_address: 'hello@portier369.com' }]);
  });

  it('falls back to the platform address when the provider refuses the company domain', async () => {
    queued = [email()];
    domains = [verified];
    refuseBranded = true;
    expect(await runWorker()).toMatchObject({ sent: 1, failed: 0 });
    expect(sent).toEqual([
      { from: 'Stellar Property Group <notices@stellarpropertygroup.com>', key: brandedKey },
      { from: 'Stellar Property Group <hello@portier369.com>', key: 'email-queue-e1' },
    ]);
    // The fallback is stored before it is sent, so a retry replays it.
    expect(snapshots).toEqual([
      { id: 'e1', sender_address: 'notices@stellarpropertygroup.com' },
      { id: 'e1', sender_address: 'hello@portier369.com' },
    ]);
  });

  it("chooses afresh after this worker crashed before recording the sender", async () => {
    queued = [email({ attempt_count: 2, snapshot_claims: 2 })];
    domains = [verified];
    await runWorker();
    expect(sent).toEqual([{ from: 'Stellar Property Group <notices@stellarpropertygroup.com>', key: brandedKey }]);
  });

  it("ignores a stored sender on another company's domain", async () => {
    queued = [email({ sender_address: 'notices@othercompany.com' })];
    domains = [{ ...verified, status: 'pending' }];
    await runWorker();
    expect(sent).toEqual([{ from: 'Stellar Property Group <hello@portier369.com>', key: 'email-queue-e1' }]);
    expect(snapshots).toEqual([{ id: 'e1', sender_address: 'hello@portier369.com' }]);
  });

  it('never sends from a queued address outside the platform domain', async () => {
    queued = [email({ from_address: 'notices@othercompany.com', from_name: 'Portier369' })];
    domains = [];
    await runWorker();
    expect(sent).toEqual([{ from: 'Portier369 <hello@portier369.com>', key: 'email-queue-e1' }]);
  });

  it('keeps the platform address for a row the earlier worker attempted', async () => {
    queued = [email({ attempt_count: 2, snapshot_claims: 1 })];
    domains = [verified];
    await runWorker();
    expect(sent).toEqual([{ from: 'Stellar Property Group <hello@portier369.com>', key: 'email-queue-e1' }]);
  });
});

describe('registerSenderDomain', () => {
  const created = { id: 'd-new', name: 'stellarpropertygroup.com', status: 'not_started', records: [{ type: 'TXT' }] };

  it("reuses this company's own earlier registration", async () => {
    const { registerSenderDomain } = await import('../../lib/email/sender-domains');
    const create = vi.fn();
    const resend: any = {
      domains: {
        get: async (id: string) => ({ data: { id, name: 'stellarpropertygroup.com', status: 'verified', records: [] }, error: null }),
        create,
      },
    };
    expect(await registerSenderDomain(resend, 'stellarpropertygroup.com', 'd-own'))
      .toEqual({ ok: true, domain: { id: 'd-own', status: 'verified', records: [] } });
    expect(create).not.toHaveBeenCalled();
  });

  it("never adopts another registration of the domain (it may be verified for someone else)", async () => {
    const { registerSenderDomain } = await import('../../lib/email/sender-domains');
    const resend: any = {
      domains: {
        get: vi.fn(),
        list: vi.fn(),
        create: async () => ({ data: null, error: { message: 'Domain already exists' } }),
      },
    };
    const result = await registerSenderDomain(resend, 'stellarpropertygroup.com', null);
    expect(result.ok).toBe(false);
    expect(resend.domains.list).not.toHaveBeenCalled();
    expect(resend.domains.get).not.toHaveBeenCalled();
  });

  it('creates a new registration when none is recorded', async () => {
    const { registerSenderDomain } = await import('../../lib/email/sender-domains');
    const resend: any = { domains: { create: async () => ({ data: created, error: null }) } };
    expect(await registerSenderDomain(resend, 'stellarpropertygroup.com', null))
      .toEqual({ ok: true, domain: { id: 'd-new', status: 'not_started', records: [{ type: 'TXT' }] } });
  });
});
