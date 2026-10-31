import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Route-level checks of GET /api/payments/autopay-run: the real handler runs
// with an in-memory service client and a mocked Stripe (no network or
// database). Covers the 2026-10-31 code review fixes: the next run date comes
// from the scheduled date, and a retried run does not count its own intent as
// a payment already in flight.

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  createOffSessionPaymentIntent: vi.fn(),
  findPaymentIntentByMetadata: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('@/lib/server/cron-auth', () => ({ requireCronSecret: () => null }));
vi.mock('@/lib/payments/stripe', () => ({
  isStripeConfigured: () => true,
  expectedStripeLivemode: () => false,
  createOffSessionPaymentIntent: mocks.createOffSessionPaymentIntent,
  isIndeterminateStripeError: () => false,
  findPaymentIntentByMetadata: mocks.findPaymentIntentByMetadata,
}));

const ACCOUNT = 'acct_TEST1234';
const MANDATE_ID = '11111111-1111-4111-8111-111111111111';
const UNIT_ID = '22222222-2222-4222-8222-222222222222';
const RUN_ID = '33333333-3333-4333-8333-333333333333';

type Row = Record<string, any>;

/** Minimal chainable stand-in for the Supabase service client. */
function fakeDb(tables: Record<string, Row[]>, rpc: (name: string, args: any) => any) {
  function builder(table: string) {
    const state: { op: string; payload?: any; filters: Array<(r: Row) => boolean> } = { op: 'select', filters: [] };
    const rows = () => (tables[table] ?? []).filter((r) => state.filters.every((f) => f(r)));
    const run = () => {
      if (state.op === 'insert') {
        const list = Array.isArray(state.payload) ? state.payload : [state.payload];
        (tables[table] ??= []).push(...list);
        return { data: list, error: null };
      }
      if (state.op === 'update') {
        const hit = rows();
        hit.forEach((r) => Object.assign(r, state.payload));
        return { data: hit, error: null };
      }
      return { data: rows(), error: null };
    };
    const b: any = {
      select() { return b; },
      insert(p: any) { state.op = 'insert'; state.payload = p; return b; },
      update(p: any) { state.op = 'update'; state.payload = p; return b; },
      eq(c: string, v: any) { state.filters.push((r) => r[c] === v); return b; },
      neq(c: string, v: any) { state.filters.push((r) => r[c] !== v); return b; },
      gt(c: string, v: any) { state.filters.push((r) => r[c] > v); return b; },
      lte(c: string, v: any) { state.filters.push((r) => r[c] <= v); return b; },
      is(c: string, v: any) { state.filters.push((r) => (r[c] ?? null) === v); return b; },
      in(c: string, v: any[]) { state.filters.push((r) => v.includes(r[c])); return b; },
      not() { return b; },
      order() { return b; },
      limit() { return b; },
      range() { return b; },
      async maybeSingle() { const r = run(); return { data: r.data?.[0] ?? null, error: null }; },
      async single() { const r = run(); return { data: r.data?.[0] ?? null, error: r.data?.[0] ? null : { message: 'no row' } }; },
      then(resolve: any, reject: any) { try { resolve(run()); } catch (e) { reject(e); } },
    };
    return b;
  }
  return { from: (t: string) => builder(t), rpc: async (name: string, args: any) => rpc(name, args) };
}

function mandate(overrides: Row = {}): Row {
  return {
    id: MANDATE_ID, status: 'active', portfolio_id: 'p1', association_id: 'a1', unit_id: UNIT_ID, owner_id: 'o1',
    day_of_month: 5, next_run_date: '2026-09-05', mode: 'current_balance', include_late_fees: true,
    authorized_amount_max_cents: 50000, skip_until: null,
    payment_methods: { processor_token: 'pm_TEST1', processor_customer_id: 'cus_TEST1', processor_account_id: ACCOUNT },
    associations: {
      name: 'Test Assoc', timezone: 'America/Chicago', stripe_account_id: ACCOUNT,
      stripe_charges_enabled: true, stripe_payouts_enabled: true, stripe_deauthorized_at: null,
    },
    units: { unit_number: '502' },
    ...overrides,
  };
}

function baseTables(m: Row): Record<string, Row[]> {
  return {
    autopay_mandates: [m],
    occupancies: [{ id: 'occ1', unit_id: UNIT_ID, owner_id: 'o1', status: 'current', allow_online_payments: true }],
    aged_receivables: [],
    unit_balances: [],
    charges: [],
    payment_intents: [],
    payment_events: [],
    stripe_autopay_runs: [],
  };
}

async function runCron() {
  const { GET } = await import('@/app/api/payments/autopay-run/route');
  const res = await GET(new Request('https://example.test/api/payments/autopay-run') as any);
  return { status: res.status, json: await res.json() };
}

describe('GET /api/payments/autopay-run', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T15:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('schedules the next run a month after the scheduled date, not after the day it ran', async () => {
    const m = mandate();
    const t = baseTables(m);
    const db = fakeDb(t, (name) => (name === 'claim_stripe_autopay_run'
      ? { data: [{ run_id: RUN_ID, idempotency_key: `autopay-run-${RUN_ID}` }], error: null }
      : { data: null, error: null }));
    mocks.createServiceClient.mockReturnValue(db);

    const res = await runCron();
    expect(res.status).toBe(200);
    // Scheduled for Sep 5 but run on Oct 20: the October 5 run is still owed.
    expect(m.next_run_date).toBe('2026-10-05');
  });

  it('a retried run does not count its own unsubmitted intent as already in flight', async () => {
    const m = mandate({ next_run_date: '2026-10-05' });
    const t = baseTables(m);
    t.aged_receivables = [{ charge_id: 'c1', unit_id: UNIT_ID, balance_due: 250, due_date: '2026-10-01' }];
    t.unit_balances = [{ unit_id: UNIT_ID, balance: 250 }];
    t.stripe_autopay_runs = [{ id: RUN_ID, mandate_id: MANDATE_ID, scheduled_for: '2026-10-05', status: 'intent_created' }];
    // The earlier attempt of this run created its local intent, then stopped
    // before reaching Stripe.
    t.payment_intents = [{
      id: RUN_ID, portfolio_id: 'p1', association_id: 'a1', unit_id: UNIT_ID, owner_id: 'o1', amount: 250,
      status: 'pending', payment_id: null, created_at: new Date().toISOString(),
      processor_account_id: ACCOUNT, processor_livemode: false, processor_payment_intent_id: null,
      idempotency_key: `autopay-run-${RUN_ID}`,
    }];
    const db = fakeDb(t, (name) => (name === 'claim_stripe_autopay_run'
      ? { data: [{ run_id: RUN_ID, idempotency_key: `autopay-run-${RUN_ID}` }], error: null }
      : { data: null, error: null }));
    mocks.createServiceClient.mockReturnValue(db);
    mocks.findPaymentIntentByMetadata.mockResolvedValue(null);
    mocks.createOffSessionPaymentIntent.mockResolvedValue({ id: 'pi_TEST1', status: 'processing', amount: 25000 });

    const res = await runCron();
    expect(res.status).toBe(200);
    expect(t.stripe_autopay_runs[0].failure_reason).not.toBe('No payable balance this cycle');
    expect(mocks.createOffSessionPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 25000 }));
  });
});
