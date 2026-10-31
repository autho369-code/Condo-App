import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Route-level checks of POST /api/stripe/webhook: the real handler runs with
// a signed request and an in-memory service client (no Stripe or database
// calls). The database side of a ledger post is covered by the rolled-back
// production runs recorded in docs/brain/Status.md.

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  getSetupIntent: vi.fn(),
  getPaymentMethod: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('@/lib/payments/reconcile', () => ({ reconcilePayouts: vi.fn() }));
vi.mock('@/lib/payments/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payments/stripe')>();
  return {
    ...actual,
    retrievePaymentIntent: mocks.retrievePaymentIntent,
    getSetupIntent: mocks.getSetupIntent,
    getPaymentMethod: mocks.getPaymentMethod,
    listPayoutBalanceTransactions: vi.fn(),
  };
});

const SECRET = 'whsec_' + 'b'.repeat(32);
const ACCOUNT = 'acct_TEST1234';
const INTENT_ID = '11111111-1111-4111-8111-111111111111';
const ASSOC_ID = '22222222-2222-4222-8222-222222222222';
const UNIT_ID = '33333333-3333-4333-8333-333333333333';
const PAYMENT_ID = '44444444-4444-4444-8444-444444444444';

type Row = Record<string, any>;

/** Minimal chainable stand-in for the Supabase service client. */
function fakeDb(tables: Record<string, Row[]>, rpc: (name: string, args: any) => any) {
  const calls: { op: string; table: string; payload?: any; filters: [string, string, any][] }[] = [];
  const rpcCalls: { name: string; args: any }[] = [];
  function builder(table: string) {
    const state: { op: string; payload?: any; filters: [string, string, any][]; selected: boolean; count?: boolean } = {
      op: 'select', filters: [], selected: false,
    };
    const rows = () => (tables[table] ?? []).filter((r) => state.filters.every(([kind, col, val]) => {
      if (kind === 'eq') return r[col] === val;
      if (kind === 'neq') return r[col] !== val;
      if (kind === 'not_in') return !String(val).replace(/[()"]/g, '').split(',').includes(r[col]);
      if (kind === 'is') return (r[col] ?? null) === val;
      if (kind === 'in') return (val as any[]).includes(r[col]);
      return true;
    }));
    const run = () => {
      calls.push({ op: state.op, table, payload: state.payload, filters: state.filters });
      if (state.op === 'insert' || state.op === 'upsert') {
        const list = Array.isArray(state.payload) ? state.payload : [state.payload];
        const added = list.map((p: Row) => ({ id: `${table}-${(tables[table]?.length ?? 0) + 1}`, ...p }));
        (tables[table] ??= []).push(...added);
        return { data: added, error: null };
      }
      if (state.op === 'update') {
        const hit = rows();
        hit.forEach((r) => Object.assign(r, state.payload));
        return { data: hit.map((r) => ({ id: r.id })), error: null };
      }
      const found = rows();
      return state.count ? { data: null, count: found.length, error: null } : { data: found, error: null };
    };
    const b: any = {
      select(_cols?: string, opts?: { count?: string }) { state.selected = true; if (opts?.count) state.count = true; return b; },
      insert(p: any) { state.op = 'insert'; state.payload = p; return b; },
      upsert(p: any) { state.op = 'upsert'; state.payload = p; return b; },
      update(p: any) { state.op = 'update'; state.payload = p; return b; },
      eq(c: string, v: any) { state.filters.push(['eq', c, v]); return b; },
      neq(c: string, v: any) { state.filters.push(['neq', c, v]); return b; },
      not(c: string, _op: string, v: any) { state.filters.push(['not_in', c, v]); return b; },
      is(c: string, v: any) { state.filters.push(['is', c, v]); return b; },
      in(c: string, v: any[]) { state.filters.push(['in', c, v]); return b; },
      limit() { return b; },
      order() { return b; },
      async maybeSingle() { const r = run(); return { data: r.data?.[0] ?? null, error: null }; },
      async single() { const r = run(); return { data: r.data?.[0] ?? null, error: r.data?.[0] ? null : { message: 'no row' } }; },
      then(resolve: any, reject: any) { try { resolve(run()); } catch (e) { reject(e); } },
    };
    return b;
  }
  return {
    client: {
      from: (t: string) => builder(t),
      rpc: async (name: string, args: any) => { rpcCalls.push({ name, args }); return rpc(name, args); },
    },
    calls,
    rpcCalls,
  };
}

function signed(body: string, secret = SECRET) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`, 'utf8').digest('hex');
  return `t=${t},v1=${v1}`;
}

async function post(event: any, signature?: string) {
  const { POST } = await import('@/app/api/stripe/webhook/route');
  const body = JSON.stringify(event);
  const req = new Request('https://example.test/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature ?? signed(body), 'content-type': 'application/json' },
    body,
  });
  const res = await POST(req as any);
  return { status: res.status, json: await res.json() };
}

function succeededEvent(overrides: Row = {}) {
  return {
    id: 'evt_TEST1', type: 'payment_intent.succeeded', livemode: false, account: ACCOUNT,
    data: { object: {
      id: 'pi_TEST1', amount_received: 25000, currency: 'usd',
      metadata: { intent_id: INTENT_ID },
      latest_charge: { id: 'ch_TEST1', payment_method_details: { type: 'card' } },
      ...overrides,
    } },
  };
}

function tables(): Record<string, Row[]> {
  return {
    payment_intents: [{
      id: INTENT_ID, association_id: ASSOC_ID, unit_id: UNIT_ID, owner_id: 'o1', portfolio_id: 'p1',
      amount: 250, currency: 'usd', status: 'pending', payment_id: null,
      processor_account_id: null, processor_livemode: null,
    }],
    associations: [{ id: ASSOC_ID, portfolio_id: 'p1', stripe_account_id: ACCOUNT, name: 'Test Assoc' }],
    owners: [{ id: 'o1', full_name: 'Test Owner', email: 'owner@example.test' }],
    units: [{ id: UNIT_ID, unit_number: '502' }],
    stripe_webhook_events: [],
    payment_events: [],
    email_queue: [],
  };
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_' + 'a'.repeat(32));
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET);
    vi.stubEnv('STRIPE_LIVEMODE', '');
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: { balance_transaction: { fee: 755 } } });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('rejects a bad signature before touching the database', async () => {
    const res = await post(succeededEvent(), signed('different body'));
    expect(res.status).toBe(400);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('rejects a signature made with another secret', async () => {
    const event = succeededEvent();
    const res = await post(event, signed(JSON.stringify(event), 'whsec_' + 'c'.repeat(32)));
    expect(res.status).toBe(400);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('rejects a live event when the server runs in test mode', async () => {
    const res = await post({ ...succeededEvent(), livemode: true });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/environment/i);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('rejects a payment event without the connected account', async () => {
    const { account: _a, ...noAccount } = succeededEvent();
    const res = await post(noAccount);
    expect(res.status).toBe(400);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('posts a settled payment to the ledger once and records it', async () => {
    const t = tables();
    const db = fakeDb(t, (name) => {
      if (name === 'claim_stripe_webhook_event') return { data: true, error: null };
      if (name === 'post_stripe_ledger_payment') return { data: PAYMENT_ID, error: null };
      return { data: null, error: null };
    });
    mocks.createServiceClient.mockReturnValue(db.client);

    const res = await post(succeededEvent());
    expect(res.status).toBe(200);
    expect(db.rpcCalls.filter((c) => c.name === 'post_stripe_ledger_payment')).toEqual([{
      name: 'post_stripe_ledger_payment',
      args: { p_intent_id: INTENT_ID, p_method: 'card', p_processor_payment_intent_id: 'pi_TEST1', p_processor_account_id: ACCOUNT },
    }]);
    const intent = t.payment_intents[0];
    expect(intent).toMatchObject({ status: 'succeeded', payment_id: PAYMENT_ID, processor_account_id: ACCOUNT, processor_charge_id: 'ch_TEST1' });
    expect(t.email_queue).toHaveLength(1);
    expect(t.email_queue[0]).toMatchObject({ idempotency_key: `stripe-receipt:${INTENT_ID}`, to_email: 'owner@example.test' });
    expect(t.payment_events.map((e) => e.event)).toContain('ledger_posted');
    expect(db.calls.some((c) => c.table === 'stripe_webhook_events' && c.op === 'update' && c.payload?.status === 'processed')).toBe(true);
  });

  it('a late "succeeded" after a refund, dispute, return or cancellation posts, receipts and logs nothing', async () => {
    for (const status of ['refunded', 'chargeback', 'returned', 'canceled']) {
      const t = tables();
      t.payment_intents[0].status = status;
      const db = fakeDb(t, (name) => {
        if (name === 'claim_stripe_webhook_event') return { data: true, error: null };
        if (name === 'post_stripe_ledger_payment') return { data: PAYMENT_ID, error: null };
        return { data: null, error: null };
      });
      mocks.createServiceClient.mockReturnValue(db.client);

      const res = await post(succeededEvent());
      expect(res.status).toBe(200);
      expect(db.rpcCalls.some((c) => c.name === 'post_stripe_ledger_payment')).toBe(false);
      expect(t.payment_intents[0].status).toBe(status);
      expect(t.email_queue).toHaveLength(0);
      expect(t.payment_events).toHaveLength(0);
    }
  });

  it('records an ACH settlement as ach', async () => {
    const t = tables();
    const db = fakeDb(t, (name) => ({ data: name === 'post_stripe_ledger_payment' ? PAYMENT_ID : true, error: null }));
    mocks.createServiceClient.mockReturnValue(db.client);
    const res = await post(succeededEvent({ latest_charge: { id: 'ch_TEST2', payment_method_details: { type: 'us_bank_account' } } }));
    expect(res.status).toBe(200);
    expect(db.rpcCalls.find((c) => c.name === 'post_stripe_ledger_payment')?.args.p_method).toBe('ach');
    expect(t.payment_intents[0].method).toBe('ach');
  });

  it('answers a repeated, already processed event without posting again', async () => {
    const t = tables();
    t.stripe_webhook_events.push({ event_id: 'evt_TEST1', processor_account_id: ACCOUNT, event_type: 'payment_intent.succeeded', status: 'processed' });
    const db = fakeDb(t, (name) => ({ data: name === 'claim_stripe_webhook_event' ? false : null, error: null }));
    mocks.createServiceClient.mockReturnValue(db.client);
    const res = await post(succeededEvent());
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ duplicate: true });
    expect(db.rpcCalls.some((c) => c.name === 'post_stripe_ledger_payment')).toBe(false);
  });

  it('refuses a settlement whose amount does not match the local payment', async () => {
    const t = tables();
    const db = fakeDb(t, (name) => ({ data: name === 'claim_stripe_webhook_event' ? true : PAYMENT_ID, error: null }));
    mocks.createServiceClient.mockReturnValue(db.client);
    const res = await post(succeededEvent({ amount_received: 1 }));
    expect(res.status).toBe(500);
    expect(db.rpcCalls.some((c) => c.name === 'post_stripe_ledger_payment')).toBe(false);
    expect(t.payment_intents[0].status).toBe('pending');
    expect(db.calls.some((c) => c.table === 'stripe_webhook_events' && c.payload?.status === 'failed')).toBe(true);
  });

  it('refuses a settlement from a different connected account', async () => {
    const t = tables();
    const db = fakeDb(t, (name) => ({ data: name === 'claim_stripe_webhook_event' ? true : PAYMENT_ID, error: null }));
    mocks.createServiceClient.mockReturnValue(db.client);
    const res = await post({ ...succeededEvent(), account: 'acct_OTHER999' });
    expect(res.status).toBe(500);
    expect(db.rpcCalls.some((c) => c.name === 'post_stripe_ledger_payment')).toBe(false);
  });

  it('marks a failed payment failed without posting to the ledger', async () => {
    const t = tables();
    const db = fakeDb(t, (name) => ({ data: name === 'claim_stripe_webhook_event' ? true : null, error: null }));
    mocks.createServiceClient.mockReturnValue(db.client);
    const res = await post({
      id: 'evt_TEST3', type: 'payment_intent.payment_failed', livemode: false, account: ACCOUNT,
      data: { object: { id: 'pi_TEST1', amount: 25000, currency: 'usd', metadata: { intent_id: INTENT_ID }, last_payment_error: { message: 'Card declined' } } },
    });
    expect(res.status).toBe(200);
    expect(t.payment_intents[0]).toMatchObject({ status: 'failed', failure_reason: 'Card declined' });
    expect(db.rpcCalls.some((c) => c.name === 'post_stripe_ledger_payment')).toBe(false);
  });

  it('undoes the AutoPay it enrolled when the owner canceled the setup meanwhile', async () => {
    const ATTEMPT_ID = '55555555-5555-4555-8555-555555555555';
    const t = tables();
    t.associations[0] = {
      ...t.associations[0], timezone: 'America/Chicago',
      stripe_charges_enabled: true, stripe_payouts_enabled: true, stripe_deauthorized_at: null,
    };
    t.stripe_setup_attempts = [{
      id: ATTEMPT_ID, status: 'session_created', processor_session_id: 'cs_SETUP1', processor_account_id: ACCOUNT,
      portfolio_id: 'p1', association_id: ASSOC_ID, owner_id: 'o1', unit_id: UNIT_ID,
      expires_at: new Date(Date.now() + 3600_000).toISOString(), day_of_month: 5, mode: 'current_balance',
      authorized_amount_max_cents: 50000, fixed_amount_cents: null, minimum_amount_cents: null, include_late_fees: false,
    }];
    t.occupancies = [{ owner_id: 'o1', unit_id: UNIT_ID, association_id: ASSOC_ID, status: 'current' }];
    t.payment_methods = [];
    // The owner's cancel lands while the webhook creates the mandate.
    const mandates: Row[] = [];
    const push = mandates.push.bind(mandates);
    mandates.push = (...rows: Row[]) => {
      t.stripe_setup_attempts[0].status = 'canceled';
      return push(...rows);
    };
    t.autopay_mandates = mandates;
    mocks.getSetupIntent.mockResolvedValue({
      id: 'seti_SETUP1', status: 'succeeded', usage: 'off_session', payment_method: 'pm_SETUP1', customer: 'cus_SETUP1',
    });
    mocks.getPaymentMethod.mockResolvedValue({ id: 'pm_SETUP1', type: 'card', customer: 'cus_SETUP1', card: { last4: '4242', brand: 'visa' } });
    const db = fakeDb(t, () => ({ data: true, error: null }));
    mocks.createServiceClient.mockReturnValue(db.client);

    const res = await post({
      id: 'evt_SETUP1', type: 'checkout.session.completed', livemode: false, account: ACCOUNT,
      data: { object: {
        id: 'cs_SETUP1', mode: 'setup', setup_intent: 'seti_SETUP1', customer: 'cus_SETUP1',
        metadata: { purpose: 'autopay_setup', setup_attempt_id: ATTEMPT_ID },
      } },
    });

    expect(res.status).toBe(200);
    expect(t.autopay_mandates).toHaveLength(1);
    expect(t.autopay_mandates[0].status).toBe('canceled');
    expect(t.stripe_setup_attempts[0].status).toBe('canceled');
    expect(t.payment_methods[0].archived_at).toBeTruthy();
    expect(t.payment_methods[0].is_default).toBe(false);
  });

  it('a retried completion for a canceled setup undoes what an earlier delivery enrolled', async () => {
    const ATTEMPT_ID = '66666666-6666-4666-8666-666666666666';
    const t = tables();
    t.stripe_setup_attempts = [{
      id: ATTEMPT_ID, status: 'canceled', processor_session_id: 'cs_SETUP2', processor_account_id: ACCOUNT,
      portfolio_id: 'p1', association_id: ASSOC_ID, owner_id: 'o1', unit_id: UNIT_ID,
      expires_at: new Date(Date.now() + 3600_000).toISOString(), day_of_month: 5, mode: 'current_balance',
    }];
    // An earlier delivery enrolled before the attempt ended, then failed.
    t.autopay_mandates = [
      { id: 'm-1', setup_attempt_id: ATTEMPT_ID, portfolio_id: 'p1', owner_id: 'o1', unit_id: UNIT_ID, payment_method_id: 'pm-row-1', status: 'active' },
      // Another setup's live mandate is not touched.
      { id: 'm-2', setup_attempt_id: 'other-attempt', portfolio_id: 'p1', owner_id: 'o1', unit_id: 'other-unit', payment_method_id: 'pm-row-2', status: 'active' },
    ];
    t.payment_methods = [
      { id: 'pm-row-1', portfolio_id: 'p1', owner_id: 'o1', archived_at: null, is_default: true },
      { id: 'pm-row-2', portfolio_id: 'p1', owner_id: 'o1', archived_at: null, is_default: true },
    ];
    const db = fakeDb(t, () => ({ data: true, error: null }));
    mocks.createServiceClient.mockReturnValue(db.client);

    const res = await post({
      id: 'evt_SETUP2', type: 'checkout.session.completed', livemode: false, account: ACCOUNT,
      data: { object: {
        id: 'cs_SETUP2', mode: 'setup', setup_intent: 'seti_SETUP2', customer: 'cus_SETUP2',
        metadata: { purpose: 'autopay_setup', setup_attempt_id: ATTEMPT_ID },
      } },
    });

    expect(res.status).toBe(200);
    expect(t.autopay_mandates.find((m) => m.id === 'm-1')?.status).toBe('canceled');
    expect(t.autopay_mandates.find((m) => m.id === 'm-2')?.status).toBe('active');
    expect(t.payment_methods.find((m) => m.id === 'pm-row-1')?.archived_at).toBeTruthy();
    expect(t.payment_methods.find((m) => m.id === 'pm-row-2')?.archived_at).toBeNull();
    expect(mocks.getSetupIntent).not.toHaveBeenCalled();
  });

  it('a retry that fails an expired setup undoes what an earlier delivery enrolled', async () => {
    const ATTEMPT_ID = '77777777-7777-4777-8777-777777777777';
    const t = tables();
    t.stripe_setup_attempts = [{
      id: ATTEMPT_ID, status: 'session_created', processor_session_id: 'cs_SETUP3', processor_account_id: ACCOUNT,
      portfolio_id: 'p1', association_id: ASSOC_ID, owner_id: 'o1', unit_id: UNIT_ID,
      // The retry arrives after the setup window closed.
      expires_at: new Date(Date.now() - 60_000).toISOString(), day_of_month: 5, mode: 'current_balance',
    }];
    t.autopay_mandates = [
      { id: 'm-3', setup_attempt_id: ATTEMPT_ID, portfolio_id: 'p1', owner_id: 'o1', unit_id: UNIT_ID, payment_method_id: 'pm-row-3', status: 'active' },
    ];
    // An earlier run canceled another mandate but died before retiring its method.
    t.autopay_mandates.push({ id: 'm-4', setup_attempt_id: ATTEMPT_ID, portfolio_id: 'p1', owner_id: 'o1', unit_id: UNIT_ID, payment_method_id: 'pm-row-4', status: 'canceled' });
    t.payment_methods = [
      { id: 'pm-row-3', portfolio_id: 'p1', owner_id: 'o1', archived_at: null, is_default: true },
      { id: 'pm-row-4', portfolio_id: 'p1', owner_id: 'o1', archived_at: null, is_default: true },
    ];
    const db = fakeDb(t, () => ({ data: true, error: null }));
    mocks.createServiceClient.mockReturnValue(db.client);

    const res = await post({
      id: 'evt_SETUP3', type: 'checkout.session.completed', livemode: false, account: ACCOUNT,
      data: { object: {
        id: 'cs_SETUP3', mode: 'setup', setup_intent: 'seti_SETUP3', customer: 'cus_SETUP3',
        metadata: { purpose: 'autopay_setup', setup_attempt_id: ATTEMPT_ID },
      } },
    });

    // The delivery fails loudly (Stripe retries), but AutoPay is already undone.
    expect(res.status).toBe(500);
    expect(t.stripe_setup_attempts[0].status).toBe('expired');
    expect(t.autopay_mandates.find((m) => m.id === 'm-3')?.status).toBe('canceled');
    expect(t.payment_methods.every((m) => m.archived_at)).toBe(true);
  });
});
