import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { recordInboundReply } from '@/lib/sms/inbound-reply';

type Row = Record<string, any>;

/** Minimal chainable stand-in for the service client. */
function fakeDb(tables: Record<string, Row[]>) {
  function builder(table: string) {
    const state: { op: string; payload?: any; filters: [string, string, any][] } = { op: 'select', filters: [] };
    const rows = () => (tables[table] ?? []).filter((r) => state.filters.every(([k, c, v]) => {
      if (k === 'eq') return r[c] === v;
      if (k === 'is') return (r[c] ?? null) === v;
      if (k === 'in') return (v as any[]).includes(r[c]);
      if (k === 'not_null') return r[c] != null;
      return true;
    }));
    const run = () => {
      if (state.op === 'insert') {
        const added = { id: `${table}-${(tables[table]?.length ?? 0) + 1}`, ...state.payload };
        (tables[table] ??= []).push(added);
        return { data: added, error: null };
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
      eq(c: string, v: any) { state.filters.push(['eq', c, v]); return b; },
      is(c: string, v: any) { state.filters.push(['is', c, v]); return b; },
      in(c: string, v: any[]) { state.filters.push(['in', c, v]); return b; },
      not(c: string) { state.filters.push(['not_null', c, null]); return b; },
      order() { return b; },
      limit() { return b; },
      async single() { return run(); },
      async maybeSingle() { const r = run(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: null }; },
      then(resolve: any) { resolve(run()); },
    };
    return b;
  }
  return { from: (t: string) => builder(t) };
}

const FROM = '+15555550100';
const TO = '+15555550199';

describe('inbound SMS replies', () => {
  it('records a reply in the sender\'s conversation and marks it unread', async () => {
    const tables: Record<string, Row[]> = {
      sms_conversations: [{ id: 'c1', portfolio_id: 'p1', with_phone_number: FROM, our_phone_number: TO, unread_count: 2, archived_at: null }],
      sms_messages: [],
    };
    const result = await recordInboundReply(fakeDb(tables), { from: FROM, to: TO, body: ' Thanks, see you Friday ', messageSid: 'SM1' });
    expect(result).toEqual({ status: 'recorded', conversationId: 'c1' });
    // The sms_messages trigger keeps the conversation's preview and unread count.
    expect(tables.sms_messages[0]).toMatchObject({ conversation_id: 'c1', direction: 'inbound', body: 'Thanks, see you Friday', provider_message_id: 'SM1', status: 'delivered', read_at: null });
  });

  it('records a retried webhook once', async () => {
    const tables: Record<string, Row[]> = {
      sms_conversations: [{ id: 'c1', portfolio_id: 'p1', with_phone_number: FROM, our_phone_number: TO, unread_count: 0, archived_at: null }],
      sms_messages: [{ id: 'm1', provider_message_id: 'SM1' }],
    };
    await expect(recordInboundReply(fakeDb(tables), { from: FROM, to: TO, body: 'Hi', messageSid: 'SM1' })).resolves.toEqual({ status: 'duplicate' });
    expect(tables.sms_messages).toHaveLength(1);
  });

  it('refuses to guess between two companies', async () => {
    const tables: Record<string, Row[]> = {
      sms_conversations: [
        { id: 'c1', portfolio_id: 'p1', with_phone_number: FROM, our_phone_number: '+15555550111', unread_count: 0, archived_at: null },
        { id: 'c2', portfolio_id: 'p2', with_phone_number: FROM, our_phone_number: '+15555550122', unread_count: 0, archived_at: null },
      ],
      sms_messages: [],
    };
    await expect(recordInboundReply(fakeDb(tables), { from: FROM, to: TO, body: 'Hi', messageSid: 'SM2' })).resolves.toMatchObject({ status: 'ambiguous', portfolioIds: ['p1', 'p2'] });
    expect(tables.sms_messages).toHaveLength(0);
  });

  it('starts a conversation for a sender known to one company, and ignores strangers', async () => {
    const known: Record<string, Row[]> = {
      sms_conversations: [],
      sms_messages: [],
      sms_opt_ins: [{ portfolio_id: 'p1', entity_type: 'owner', entity_id: 'o1', phone_number: FROM }],
      owners: [{ id: 'o1', full_name: 'Liam Owner' }],
      occupancies: [{ owner_id: 'o1', occupancy_type: 'owner', status: 'current', association_id: 'a1' }],
    };
    const result = await recordInboundReply(fakeDb(known), { from: FROM, to: TO, body: 'Hello', messageSid: 'SM3' });
    expect(result.status).toBe('recorded');
    // In the owner's association, so managers of other associations don't see it.
    expect(known.sms_conversations[0]).toMatchObject({ portfolio_id: 'p1', association_id: 'a1', with_entity_id: 'o1', with_name: 'Liam Owner' });

    const strangers: Record<string, Row[]> = { sms_conversations: [], sms_messages: [], sms_opt_ins: [] };
    await expect(recordInboundReply(fakeDb(strangers), { from: FROM, to: TO, body: 'Hello', messageSid: 'SM4' }))
      .resolves.toEqual({ status: 'ignored', reason: 'unknown sender' });
  });

  it('does not file a text with one company when another company also knows the sender', async () => {
    const tables: Record<string, Row[]> = {
      // An old conversation at company A; the sender now texts company B's number.
      sms_conversations: [{ id: 'c1', portfolio_id: 'pA', with_phone_number: FROM, our_phone_number: '+15555550111', archived_at: null }],
      sms_opt_ins: [{ portfolio_id: 'pB', entity_type: 'owner', entity_id: 'o9', phone_number: FROM }],
      sms_messages: [],
    };
    await expect(recordInboundReply(fakeDb(tables), { from: FROM, to: TO, body: 'Hi', messageSid: 'SM5' }))
      .resolves.toMatchObject({ status: 'ambiguous' });
    expect(tables.sms_messages).toHaveLength(0);
  });
});
